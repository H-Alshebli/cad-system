import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { epcrActor } from "@/lib/server/epcrReviewAuth";
import { enqueueReviewNotice } from "@/lib/server/reviewNotificationOutbox";
import { calculateReadiness, removeUndefinedValues, READINESS_TEMPLATE_VERSION, quantityValidationMessage, identifierValidationMessage, classifyReadinessItem, doesChecklistShiftMatch, normalizeDeploymentType } from "@/lib/readinessChecklistCore";
export const runtime = "nodejs";
const fields = ['projectId','projectName','missionId','missionLabel','unitId','unitCode','shiftId','shiftKey','shiftName','shiftDate','shiftStartTime','shiftEndTime','crewUserIds','crewAssignmentSource','serviceType','deploymentType','checklistCategory','checklistPhase','sourceChecklistId','startedFromMissionId','linkedMissionIds','dateKey','notes','startedAtMs','durationSeconds','manualProjectName','manualMissionLabel','allowDuplicate','submissionAcknowledgement','items'];
const version = (data: any) => String(data?.updatedAt?.toMillis?.() || 0);
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await epcrActor(request.headers.get("authorization"));
  if (!actor) return NextResponse.json({ error: "Active employee authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !params.id || params.id.includes('/') || params.id.length > 200 || !/^[a-f0-9-]{36}$/i.test(body.requestId || '') || !['create','submit','approve','return','comment'].includes(body.action) || JSON.stringify(body).length > 700000)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const action = body.action;
  const submitting = action === 'submit' || (action === 'create' && body.status === 'submitted');
  const can = (permission: string) => actor.can('readiness_checklists', permission);
  if ((action === 'create' && !can('create')) || (submitting && !can('submit')) || (['approve','return','comment'].includes(action) && (!can('review') || (action !== 'comment' && !can(action === 'return' ? 'return_for_correction' : 'approve')))))
    return NextResponse.json({ error: "Checklist permission denied." }, { status: 403 });
  if (action === 'create' && !['draft','submitted'].includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > 4000 || (['comment','return'].includes(action) && !notes)) return NextResponse.json({ error: "A review comment is required (maximum 4,000 characters)." }, { status: 400 });
  const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  try {
    await adminDb.runTransaction(async tx => {
      const ref = adminDb.collection('projectChecklists').doc(params.id);
      const eventRef = ref.collection('reviewEvents').doc(body.requestId);
      const [snapshot, existing] = await Promise.all([tx.get(ref), tx.get(eventRef)]);
      if (existing.exists) {
        if (existing.data()?.actorId !== actor.uid || existing.data()?.fingerprint !== fingerprint) throw Error('Checklist request conflict.');
        return;
      }
      const current = snapshot.data();
      if (action === 'create' ? snapshot.exists : !snapshot.exists) throw Error('Checklist state changed. Refresh first.');
      if (action !== 'create' && body.baseVersion !== version(current)) throw Error('Checklist changed. Refresh before saving.');
      const now = new Date();
      let data: any = current;
      let patch: any = {};
      if (action === 'create' || action === 'submit') {
        if (action === 'submit' && (current?.inspectorUserId !== actor.uid || !['draft','returned_for_correction'].includes(current.status))) throw Error('Checklist cannot be submitted by this user in its current state.');
        const payload = body.payload || {};
        if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 1500 || typeof payload.notes !== 'string' && payload.notes != null) throw Error('Checklist items are invalid.');
        if (payload.items.some((item: any) => !item || typeof item.id !== 'string' || !['unchecked','checked','some','missing','not_available','not_applicable'].includes(item.status))) throw Error('Checklist items are invalid.');
        if (submitting && (payload.submissionAcknowledgement?.acknowledged !== true || payload.items.some((item: any) => quantityValidationMessage(item) || identifierValidationMessage(item) || (classifyReadinessItem(item).vehicleSeverity === 'red' && item.status === 'unchecked')))) throw Error('Checklist required fields and acknowledgement must be completed.');
        if (action === 'create') {
          if (typeof payload.projectId !== 'string' || !payload.projectId || typeof payload.unitId !== 'string' || !payload.unitId || typeof payload.dateKey !== 'string' || typeof payload.shiftKey !== 'string') throw Error('Checklist project, unit, date and shift are required.');
          // Also protect against pre-migration checklists, not just new guards.
          if (payload.allowDuplicate !== true) {
            const deployment = normalizeDeploymentType(payload.deploymentType || payload.checklistCategory || 'Ambulance');
            const legacy = await tx.get(adminDb.collection('projectChecklists').where('unitId','==',payload.unitId).select('dateKey','shiftKey','shiftId','deploymentType','checklistCategory','checklistPhase'));
            if (legacy.docs.some(row => { const value = row.data(); return value.dateKey === payload.dateKey && doesChecklistShiftMatch(value, payload.shiftKey, payload.shiftId) && normalizeDeploymentType(value.deploymentType || value.checklistCategory || 'Ambulance') === deployment && (value.checklistPhase || 'opening') === (payload.checklistPhase || 'opening'); })) throw Error('Checklist already exists for this unit and shift.');
            const key = createHash('sha256').update(JSON.stringify([payload.unitId, payload.dateKey, payload.shiftId || payload.shiftKey, deployment, payload.checklistPhase || 'opening'])).digest('hex');
            const guard = adminDb.collection('checklistCreationKeys').doc(key);
            if ((await tx.get(guard)).exists) throw Error('Checklist already exists for this unit and shift.');
            tx.create(guard, { checklistId: params.id, at: now });
          }
          data = Object.fromEntries(fields.filter(key => payload[key] !== undefined).map(key => [key, payload[key]]));
          data = { ...data, checklistPhase: payload.checklistPhase || 'opening', inspectorUserId: actor.uid, inspectorName: actor.name, inspectorEmployeeId: String(payload.inspectorEmployeeId || ''), templateVersion: READINESS_TEMPLATE_VERSION, createdAt: now };
        }
        patch = { ...(action === 'create' ? data : {}), items: payload.items, notes: payload.notes || '',
          ...removeUndefinedValues(calculateReadiness(payload.items)), durationSeconds: Number(payload.durationSeconds || 0),
          status: submitting ? 'submitted' : 'draft', updatedAt: now };
        if (submitting) Object.assign(patch, { submittedAt: now, submittedAtMs: now.getTime(), notificationCohortAt: now.toISOString(),
          submissionAcknowledgement: { ...payload.submissionAcknowledgement, acknowledgedBy: actor.uid, acknowledgedByName: actor.name, acknowledgedAtMs: now.getTime() } });
      } else {
        if (current?.status !== 'submitted') throw Error('Checklist must be submitted before review.');
        if (!can('view_all') && !(current.inspectorUserId === actor.uid && (can('view') || can('view_own')))) throw Error('Checklist is outside your review scope.');
        patch = { reviewNotes: notes, updatedAt: now };
        if (action !== 'comment') Object.assign(patch, { status: action === 'approve' ? 'approved' : 'returned_for_correction', reviewedAt: now, reviewedBy: actor.uid, reviewedByName: actor.name, approvedAt: action === 'approve' ? now : null });
      }
      if (action === 'create') tx.create(ref, patch); else tx.update(ref, patch);
      tx.create(eventRef, { actorId: actor.uid, action, notes, at: now, fingerprint });
      if (submitting || action !== 'create') enqueueReviewNotice(tx, body.requestId, {
        kind: 'checklist', recordId: params.id, projectId: data.projectId, ownerId: data.inspectorUserId,
        action: submitting ? 'submit' : action, at: now.toISOString(),
      }, submitting ? now.toISOString() : current?.notificationCohortAt);
    });
    return NextResponse.json({ id: params.id });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('Checklist ') ? error.message : 'Checklist could not be saved. Retry the same request.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
