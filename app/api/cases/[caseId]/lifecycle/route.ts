import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { normalizeRolePermissions } from "@/lib/permissionsMatrix";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

type Actor = { uid: string; name: string; role: string; isAdmin: boolean; permissions: Record<string, Record<string, boolean>> };

function isAdminRole(role: string) {
  return ["admin", "super_admin", "superadmin"].includes(role.trim().toLowerCase());
}

async function authenticate(request: NextRequest): Promise<Actor | null> {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const userSnapshot = await adminDb.collection("users").doc(token.uid).get();
    if (!userSnapshot.exists) return null;
    const user = userSnapshot.data() || {};
    const role = String(user.role || "");
    const isAdmin = isAdminRole(role);
    const roleSnapshot = !isAdmin && role ? await adminDb.collection("roles").doc(role).get() : null;
    return {
      uid: token.uid,
      name: String(user.name || user.displayName || token.email || "HCAD User"),
      role,
      isAdmin,
      permissions: isAdmin ? {} : normalizeRolePermissions(roleSnapshot?.data()?.permissions || {}, role),
    };
  } catch {
    return null;
  }
}

function can(actor: Actor, action: string) {
  return actor.isAdmin || actor.permissions?.cases?.[action] === true;
}

function isAssigned(caseData: Record<string, any>, userId: string) {
  return [
    ...(Array.isArray(caseData.assignedUserIds) ? caseData.assignedUserIds : []),
    ...(Array.isArray(caseData.participantUserIds) ? caseData.participantUserIds : []),
  ].includes(userId);
}

function unitId(caseData: Record<string, any>) {
  return caseData.assignedUnit?.type === "ambulance"
    ? String(caseData.assignedUnit.id || "")
    : String(caseData.ambulanceId || "");
}

function isClosed(status: unknown) {
  return ["closed", "completed"].includes(String(status || "").trim().toLowerCase());
}

function isCancelled(status: unknown) {
  return ["cancelled", "canceled"].includes(String(status || "").trim().toLowerCase());
}

export async function POST(request: NextRequest, { params }: { params: { caseId: string } }) {
  const actor = await authenticate(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim();
  const reason = String(body.reason || "").trim();
  const notes = String(body.notes || "").trim();
  if (!new Set(["close", "cancel", "restore"]).has(action)) {
    return NextResponse.json({ error: "Invalid case lifecycle action." }, { status: 400 });
  }

  const caseRef = adminDb.collection("cases").doc(params.caseId);
  const caseSnapshot = await caseRef.get();
  if (!caseSnapshot.exists) return NextResponse.json({ error: "CAD case not found." }, { status: 404 });
  const caseData = caseSnapshot.data() || {};
  const currentStatus = String(caseData.status || caseData.dispatchStatus || "");

  if (action === "close") {
    const allowed = can(actor, "close_any") || can(actor, "close") || (can(actor, "close_assigned") && isAssigned(caseData, actor.uid));
    if (!allowed) return NextResponse.json({ error: "You do not have permission to close this case." }, { status: 403 });
    if (isCancelled(currentStatus)) return NextResponse.json({ error: "A cancelled case must be restored before it can be closed." }, { status: 409 });
    if (isClosed(currentStatus)) return NextResponse.json({ status: "Closed", alreadyFinal: true });
    if (currentStatus !== "Returning") return NextResponse.json({ error: "The case must reach Returning before it can be closed." }, { status: 409 });

    const epcrSnapshot = await adminDb.collection("epcr").doc(params.caseId).get();
    if (!epcrSnapshot.exists || !epcrSnapshot.data()?.finalizedAt || epcrSnapshot.data()?.locked !== true) {
      return NextResponse.json({ error: "Finalize and lock the ePCR before closing this case." }, { status: 409 });
    }

    const ambulanceId = unitId(caseData);
    const ambulanceSnapshot = ambulanceId ? await adminDb.collection("ambulances").doc(ambulanceId).get() : null;
    const writer = adminDb.batch();
    writer.update(caseRef, {
      status: "Closed",
      dispatchStatus: "Closed",
      "timeline.Closed": FieldValue.serverTimestamp(),
      "timeline.closedAt": FieldValue.serverTimestamp(),
      closedBy: actor.uid,
      closedByName: actor.name,
      closedByRole: actor.role,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (ambulanceSnapshot?.exists) {
      const ambulance = ambulanceSnapshot.data() || {};
      if (String(ambulance.currentCaseId || ambulance.currentCase || "") === params.caseId) {
        writer.update(ambulanceSnapshot.ref, { status: "available", currentCase: null, currentCaseId: null, updatedAt: FieldValue.serverTimestamp() });
      }
    }
    await writer.commit();
    return NextResponse.json({ status: "Closed" });
  }

  if (action === "cancel") {
    if (!can(actor, "cancel_any")) return NextResponse.json({ error: "Dispatcher cancellation permission is required." }, { status: 403 });
    if (String(caseData.sourceType || caseData.caseType || "").toUpperCase() === "B2C") {
      return NextResponse.json({ error: "B2C cases must use the existing B2C cancellation workflow." }, { status: 409 });
    }
    if (isCancelled(currentStatus)) return NextResponse.json({ error: "This case is already cancelled." }, { status: 409 });
    if (!reason) return NextResponse.json({ error: "Cancellation reason is required." }, { status: 400 });

    const ambulanceId = unitId(caseData);
    const ambulanceSnapshot = ambulanceId ? await adminDb.collection("ambulances").doc(ambulanceId).get() : null;
    const previousState = {
      status: currentStatus,
      dispatchStatus: String(caseData.dispatchStatus || currentStatus),
      assignedUnit: caseData.assignedUnit || null,
      ambulanceId: caseData.ambulanceId || null,
      assignedUserIds: Array.isArray(caseData.assignedUserIds) ? caseData.assignedUserIds : [],
      participantUserIds: Array.isArray(caseData.participantUserIds) ? caseData.participantUserIds : [],
      acknowledged: Boolean(caseData.acknowledged),
    };
    const writer = adminDb.batch();
    writer.update(caseRef, {
      status: "Cancelled",
      dispatchStatus: "Cancelled",
      cancellationReason: reason,
      cancellationNotes: notes,
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: actor.uid,
      cancelledByName: actor.name,
      cancelledByRole: actor.role,
      cancellationPreviousState: previousState,
      "timeline.Cancelled": FieldValue.serverTimestamp(),
      "timeline.cancelledAt": FieldValue.serverTimestamp(),
      lifecycleHistory: FieldValue.arrayUnion({ action: "cancelled", reason, notes, previousStatus: currentStatus, actorId: actor.uid, actorName: actor.name, actorRole: actor.role, at: new Date().toISOString() }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (ambulanceSnapshot?.exists) {
      const ambulance = ambulanceSnapshot.data() || {};
      if (String(ambulance.currentCaseId || ambulance.currentCase || "") === params.caseId) {
        writer.update(ambulanceSnapshot.ref, { status: "available", currentCase: null, currentCaseId: null, updatedAt: FieldValue.serverTimestamp() });
      }
    }
    if (previousState.assignedUserIds.length) {
      const notificationRef = adminDb.collection("notifications").doc();
      writer.create(notificationRef, {
        type: "cad_case_cancelled",
        caseId: params.caseId,
        recipientUserIds: previousState.assignedUserIds,
        title: "CAD case cancelled",
        message: `${caseData.caseNumber || "The assigned case"} was cancelled by Dispatch. Reason: ${reason}`,
        link: `/cadcases/${params.caseId}`,
        readByUserIds: [],
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await writer.commit();
    return NextResponse.json({ status: "Cancelled" });
  }

  if (!can(actor, "restore_cancelled")) return NextResponse.json({ error: "Restore-cancelled permission is required." }, { status: 403 });
  if (!isCancelled(currentStatus)) return NextResponse.json({ error: "Only a cancelled case can be restored." }, { status: 409 });
  if (!reason) return NextResponse.json({ error: "Restoration reason is required." }, { status: 400 });

  const previous = caseData.cancellationPreviousState || {};
  const previousStatus = String(previous.status || "Received");
  const previousUnitId = previous.assignedUnit?.type === "ambulance" ? String(previous.assignedUnit.id || "") : String(previous.ambulanceId || "");
  const ambulanceSnapshot = previousUnitId ? await adminDb.collection("ambulances").doc(previousUnitId).get() : null;
  const ambulance = ambulanceSnapshot?.data() || {};
  const occupiedBy = String(ambulance.currentCaseId || ambulance.currentCase || "");
  const canRestoreAssignment = !isClosed(previousStatus) && Boolean(previousUnitId) && (!occupiedBy || occupiedBy === params.caseId);
  const needsRedispatch = !isClosed(previousStatus) && Boolean(previousUnitId) && !canRestoreAssignment;
  const restoredStatus = needsRedispatch ? "Received" : previousStatus;
  const restoredUsers = needsRedispatch ? [] : Array.isArray(previous.assignedUserIds) ? previous.assignedUserIds : [];
  const writer = adminDb.batch();
  writer.update(caseRef, {
    status: restoredStatus,
    dispatchStatus: needsRedispatch ? "NeedsRedispatch" : String(previous.dispatchStatus || restoredStatus),
    assignedUnit: needsRedispatch ? null : previous.assignedUnit || null,
    ambulanceId: needsRedispatch ? null : previous.ambulanceId || null,
    assignedUserIds: restoredUsers,
    participantUserIds: needsRedispatch ? [] : Array.isArray(previous.participantUserIds) ? previous.participantUserIds : restoredUsers,
    acknowledged: needsRedispatch ? false : Boolean(previous.acknowledged),
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy: actor.uid,
    restoredByName: actor.name,
    restoredByRole: actor.role,
    restorationReason: reason,
    restorationNotes: notes,
    needsRedispatch,
    lifecycleHistory: FieldValue.arrayUnion({ action: "restored", reason, notes, restoredStatus, needsRedispatch, actorId: actor.uid, actorName: actor.name, actorRole: actor.role, at: new Date().toISOString() }),
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (canRestoreAssignment && ambulanceSnapshot?.exists) {
    writer.update(ambulanceSnapshot.ref, { status: "busy", currentCase: params.caseId, currentCaseId: params.caseId, updatedAt: FieldValue.serverTimestamp() });
  }
  if (restoredUsers.length) {
    const notificationRef = adminDb.collection("notifications").doc();
    writer.create(notificationRef, {
      type: "cad_case_restored",
      caseId: params.caseId,
      recipientUserIds: restoredUsers,
      title: "CAD case restored",
      message: `${caseData.caseNumber || "A CAD case"} was restored by Dispatch.`,
      link: `/cadcases/${params.caseId}`,
      readByUserIds: [],
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await writer.commit();
  return NextResponse.json({ status: restoredStatus, needsRedispatch });
}
