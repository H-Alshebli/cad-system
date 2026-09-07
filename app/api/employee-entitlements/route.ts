import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  actorCan,
  authenticateEntitlementsActor,
} from "@/lib/server/employeeEntitlementsAuth";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

function serialize(value: any): any {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

function hasSubmittedCrewProfile(user: Record<string, any>) {
  const reviewStatus = String(user.crewProfileReviewStatus || "");
  return Boolean(user.crewProfileSubmittedAt) ||
    new Set(["submitted", "verified", "changes_required", "update_requested", "reopened"]).has(reviewStatus);
}

export async function GET(request: NextRequest) {
  const actor = await authenticateEntitlementsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const wantsAll = request.nextUrl.searchParams.get("scope") === "all";
  if (wantsAll && !actorCan(actor, "view_all")) {
    return NextResponse.json({ error: "View-all permission is required." }, { status: 403 });
  }
  if (!wantsAll && !actorCan(actor, "view_own")) {
    return NextResponse.json({ error: "View-own permission is required." }, { status: 403 });
  }

  const query = wantsAll
    ? adminDb.collection("employeeEntitlements")
    : adminDb.collection("employeeEntitlements").where("userId", "==", actor.uid);
  const snapshot = await query.get();
  let records = snapshot.docs
    .map((document) => ({ id: document.id, ...serialize(document.data()) }))
    .filter((record: any) => wantsAll || record.status !== "draft")
    .sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if (wantsAll) {
    const userIds = Array.from(new Set(records.map((record: any) => String(record.userId || "")).filter(Boolean)));
    const userSnapshots = userIds.length
      ? await adminDb.getAll(...userIds.map((userId) => adminDb.collection("users").doc(userId)))
      : [];
    const usersById = new Map(userSnapshots.map((entry) => [entry.id, entry.data() || {}]));
    records = records.map((record: any) => ({
      ...record,
      profileAccessPending:
        record.status !== "draft" &&
        !hasSubmittedCrewProfile(usersById.get(String(record.userId || "")) || {}),
    }));
  }
  if (!wantsAll && records.length > 0) {
    if (!hasSubmittedCrewProfile(actor.user)) {
      return NextResponse.json({
        records: [],
        entitlementAvailable: true,
        profileRequired: true,
      });
    }
  }
  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  const actor = await authenticateEntitlementsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actorCan(actor, "send")) {
    return NextResponse.json({ error: "Send entitlement permission is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const batchId = String(body.batchId || "").trim();
  const recordId = String(body.recordId || "").trim();
  if (!new Set(["send_batch", "send_record", "edit_statement", "correct_and_resend", "reject_dispute", "relink_account"]).has(action)) {
    return NextResponse.json({ error: "Invalid send action." }, { status: 400 });
  }

  if (action === "relink_account") {
    const targetEmail = String(body.targetEmail || "").trim().toLowerCase();
    if (!recordId || !targetEmail) {
      return NextResponse.json({ error: "The entitlement record and target account email are required." }, { status: 400 });
    }

    const recordSnapshot = await adminDb.collection("employeeEntitlements").doc(recordId).get();
    if (!recordSnapshot.exists) {
      return NextResponse.json({ error: "Entitlement record not found." }, { status: 404 });
    }

    const usersSnapshot = await adminDb.collection("users").get();
    const matchingUsers = usersSnapshot.docs.filter((entry) =>
      String(entry.data()?.email || "").trim().toLowerCase() === targetEmail
    );
    if (matchingUsers.length !== 1) {
      return NextResponse.json(
        { error: matchingUsers.length ? "More than one account uses this email. Resolve the duplicate accounts first." : "No HCAD account was found for this email." },
        { status: 409 }
      );
    }

    const targetUserSnapshot = matchingUsers[0];
    const targetUser = targetUserSnapshot.data() || {};
    if (targetUser.active !== true || String(targetUser.accountStatus || "").toLowerCase() !== "active") {
      return NextResponse.json({ error: "The target account must be active before entitlements can be linked to it." }, { status: 409 });
    }

    const record = recordSnapshot.data() || {};
    const recordEmployeeId = String(record.employeeId || "").trim();
    const targetEmployeeId = String(targetUser.employeeId || targetUser.crewProfile?.employeeId || "").trim();
    if (!recordEmployeeId || recordEmployeeId !== targetEmployeeId) {
      return NextResponse.json(
        { error: `Employee ID mismatch. This statement belongs to ${recordEmployeeId || "an unknown ID"}, while the target account uses ${targetEmployeeId || "no employee ID"}.` },
        { status: 409 }
      );
    }

    if (targetUserSnapshot.id === String(record.userId || "")) {
      return NextResponse.json({ error: "This entitlement statement is already linked to that account." }, { status: 409 });
    }

    const notificationSnapshots = await adminDb.collection("notifications").where("entitlementId", "==", recordId).get();
    const writer = adminDb.batch();
    writer.update(recordSnapshot.ref, {
      userId: targetUserSnapshot.id,
      employeeEmail: String(targetUser.email || targetEmail).trim(),
      linkedAccountName: String(targetUser.name || targetUser.displayName || ""),
      relinkedAt: FieldValue.serverTimestamp(),
      relinkedBy: actor.uid,
      relinkedByName: actor.name,
      updatedAt: FieldValue.serverTimestamp(),
      auditHistory: FieldValue.arrayUnion({
        action: "account_relinked",
        actorId: actor.uid,
        actorName: actor.name,
        previousUserId: String(record.userId || ""),
        previousEmail: String(record.employeeEmail || ""),
        targetUserId: targetUserSnapshot.id,
        targetEmail: String(targetUser.email || targetEmail).trim(),
        at: new Date().toISOString(),
      }),
    });
    notificationSnapshots.docs.forEach((notification) => {
      writer.update(notification.ref, {
        recipientUserIds: [targetUserSnapshot.id],
        recipientEmails: [String(targetUser.email || targetEmail).trim()],
      });
    });
    await writer.commit();

    return NextResponse.json({
      status: "relinked",
      userId: targetUserSnapshot.id,
      email: String(targetUser.email || targetEmail).trim(),
    });
  }

  if (action === "edit_statement" || action === "correct_and_resend" || action === "reject_dispute") {
    const document = await adminDb.collection("employeeEntitlements").doc(recordId).get();
    if (!document.exists) return NextResponse.json({ error: "Entitlement record not found." }, { status: 404 });
    const data = document.data() || {};
    if ((action === "correct_and_resend" || action === "reject_dispute") && data.status !== "disputed") {
      return NextResponse.json({ error: "Only a disputed statement can be reviewed." }, { status: 409 });
    }
    const comment = String(body.comment || "").trim();
    if (!comment) return NextResponse.json({ error: "An HR response is required." }, { status: 400 });
    const responseHistory = data.employeeResponse
      ? FieldValue.arrayUnion(data.employeeResponse)
      : FieldValue.arrayUnion();

    if (action === "reject_dispute") {
      await document.ref.update({
        status: "dispute_rejected",
        hrResolution: { action, comment, actorId: actor.uid, actorName: actor.name, at: new Date().toISOString() },
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: actor.uid,
        resolvedByName: actor.name,
        responseHistory,
        updatedAt: FieldValue.serverTimestamp(),
        auditHistory: FieldValue.arrayUnion({ action, actorId: actor.uid, comment, at: new Date().toISOString() }),
      });
    } else {
      const values = ["otEntitlement", "otPaid", "perDiemEntitlement", "perDiemPaid"].map((key) => Number(body[key]));
      if (values.some((value) => !Number.isFinite(value) || value < 0)) {
        return NextResponse.json({ error: "All corrected amounts must be valid positive numbers or zero." }, { status: 400 });
      }
      const [otEntitlement, otPaid, perDiemEntitlement, perDiemPaid] = values;
      if (otPaid > otEntitlement || perDiemPaid > perDiemEntitlement) {
        return NextResponse.json({ error: "Paid amount cannot exceed the entitlement amount." }, { status: 400 });
      }
      const normalizeMonthlyEntries = (value: unknown, label: string) => {
        if (!Array.isArray(value) || value.length > 40) throw new Error(`Invalid ${label} monthly details.`);
        return value.map((entry: any) => ({
          month: String(entry?.month || "").trim(),
          quantity: Number(entry?.quantity),
        })).filter((entry) => entry.month && entry.quantity > 0);
      };
      let monthlyOvertime: Array<{ month: string; quantity: number }>;
      let monthlyPerDiem: Array<{ month: string; quantity: number }>;
      try {
        const rawOvertime = Array.isArray(body.monthlyOvertime) ? body.monthlyOvertime : [];
        const rawPerDiem = Array.isArray(body.monthlyPerDiem) ? body.monthlyPerDiem : [];
        if ([...rawOvertime, ...rawPerDiem].some((entry: any) =>
          !String(entry?.month || "").trim() || String(entry?.month || "").length > 60 || !Number.isFinite(Number(entry?.quantity)) || Number(entry?.quantity) < 0
        )) {
          return NextResponse.json({ error: "Monthly hours and days must be valid positive numbers or zero." }, { status: 400 });
        }
        monthlyOvertime = normalizeMonthlyEntries(rawOvertime, "Overtime");
        monthlyPerDiem = normalizeMonthlyEntries(rawPerDiem, "Per Diem");
      } catch (monthlyError) {
        return NextResponse.json({ error: monthlyError instanceof Error ? monthlyError.message : "Invalid monthly details." }, { status: 400 });
      }
      const overtime = { ...(data.overtime || {}), entitlement: otEntitlement, sourcePaid: otPaid, sourceRemaining: otEntitlement - otPaid, operationalPaid: otPaid, operationalRemaining: otEntitlement - otPaid };
      const perDiem = { ...(data.perDiem || {}), entitlement: perDiemEntitlement, sourceRemaining: perDiemEntitlement - perDiemPaid, operationalPaid: perDiemPaid, operationalRemaining: perDiemEntitlement - perDiemPaid };
      const remainsDraft = action === "edit_statement" && data.status === "draft";
      const correctionUpdate: Record<string, any> = {
        overtime,
        perDiem,
        monthlyOvertime,
        monthlyPerDiem,
        combined: { entitlement: otEntitlement + perDiemEntitlement, paid: otPaid + perDiemPaid, remaining: otEntitlement - otPaid + perDiemEntitlement - perDiemPaid },
        status: remainsDraft ? "draft" : "sent",
        version: Number(data.version || 1) + 1,
        hrResolution: { action, comment, actorId: actor.uid, actorName: actor.name, at: new Date().toISOString() },
        correctedAt: FieldValue.serverTimestamp(),
        correctedBy: actor.uid,
        correctedByName: actor.name,
        updatedAt: FieldValue.serverTimestamp(),
        revisionHistory: FieldValue.arrayUnion({
          version: Number(data.version || 1),
          status: data.status || "draft",
          overtime: data.overtime || {},
          perDiem: data.perDiem || {},
          monthlyOvertime: data.monthlyOvertime || [],
          monthlyPerDiem: data.monthlyPerDiem || [],
          combined: data.combined || {},
          employeeResponse: data.employeeResponse || null,
          archivedAt: new Date().toISOString(),
        }),
        auditHistory: FieldValue.arrayUnion({ action, actorId: actor.uid, comment, previousCombined: data.combined || {}, at: new Date().toISOString() }),
      };
      if (!remainsDraft) {
        Object.assign(correctionUpdate, {
          resentAt: FieldValue.serverTimestamp(),
          sentAt: FieldValue.serverTimestamp(),
          sentBy: actor.uid,
          sentByName: actor.name,
          firstViewedAt: FieldValue.delete(),
          lastViewedAt: FieldValue.delete(),
          respondedAt: FieldValue.delete(),
          employeeResponse: FieldValue.delete(),
        });
        if (data.employeeResponse) correctionUpdate.responseHistory = responseHistory;
      }
      await document.ref.update(correctionUpdate);

      if (!remainsDraft) {
        await adminDb.collection("notifications").add({
          type: "employee_entitlement_hr_resolution",
          entitlementId: document.id,
          batchId: data.batchId,
          recipientUserIds: [data.userId],
          recipientEmails: data.employeeEmail ? [data.employeeEmail] : [],
          title: "Entitlement statement corrected",
          message: "HR corrected and resent your entitlement statement for review.",
          link: "/crew-profile#employee-entitlements",
          readByUserIds: [],
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return NextResponse.json({ status: remainsDraft ? "draft" : "sent" });
    }

    await adminDb.collection("notifications").add({
      type: "employee_entitlement_hr_resolution",
      entitlementId: document.id,
      batchId: data.batchId,
      recipientUserIds: [data.userId],
      recipientEmails: data.employeeEmail ? [data.employeeEmail] : [],
      title: "Entitlement dispute reviewed",
      message: "HR reviewed your adjustment request. Open your profile to view the response.",
      link: "/crew-profile#employee-entitlements",
      readByUserIds: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ status: "dispute_rejected" });
  }

  const documents = action === "send_batch"
    ? (await adminDb.collection("employeeEntitlements").where("batchId", "==", batchId).get()).docs
    : [await adminDb.collection("employeeEntitlements").doc(recordId).get()].filter((item) => item.exists);
  if (!documents.length) return NextResponse.json({ error: "No entitlement records found." }, { status: 404 });

  const writer = adminDb.batch();
  let sent = 0;
  documents.forEach((document) => {
    const data = document.data() || {};
    if (data.status !== "draft") return;
    sent += 1;
    writer.update(document.ref, {
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      sentBy: actor.uid,
      sentByName: actor.name,
      updatedAt: FieldValue.serverTimestamp(),
      auditHistory: FieldValue.arrayUnion({ action: "sent", actorId: actor.uid, at: new Date().toISOString() }),
    });
    const notificationRef = adminDb.collection("notifications").doc();
    writer.create(notificationRef, {
      type: "employee_entitlement",
      entitlementId: document.id,
      batchId: data.batchId,
      recipientUserIds: [data.userId],
      recipientEmails: data.employeeEmail ? [data.employeeEmail] : [],
      title: "Employee entitlement acknowledgment",
      message: `Your Overtime and Per Diem entitlement statement for ${data.period || "2025-2026"} is ready for review.`,
      link: "/crew-profile#employee-entitlements",
      readByUserIds: [],
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  if (action === "send_batch" && batchId && sent > 0) {
    writer.update(adminDb.collection("employeeEntitlementBatches").doc(batchId), {
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      sentBy: actor.uid,
      sentByName: actor.name,
      auditHistory: FieldValue.arrayUnion({ action: "sent", actorId: actor.uid, at: new Date().toISOString() }),
    });
  }
  if (sent > 0) await writer.commit();
  return NextResponse.json({ sent });
}
