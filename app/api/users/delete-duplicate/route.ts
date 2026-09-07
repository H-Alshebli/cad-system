import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

async function authenticateAdmin(request: NextRequest) {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const snapshot = await adminDb.collection("users").doc(token.uid).get();
    const role = String(snapshot.data()?.role || "").toLowerCase();
    return /admin/.test(role) ? { token, user: snapshot.data() || {} } : null;
  } catch {
    return null;
  }
}

function containsUser(value: any, userId: string): boolean {
  if (Array.isArray(value)) return value.some((item) => containsUser(item, userId));
  if (!value || typeof value !== "object") return value === userId;
  return Object.entries(value).some(([key, item]) => key === userId || containsUser(item, userId));
}

export async function POST(request: NextRequest) {
  const actor = await authenticateAdmin(request);
  if (!actor) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId || "").trim();
  const confirmation = String(body.confirmation || "").trim().toLowerCase();
  const reason = String(body.reason || "").trim();
  if (!userId || !reason) return NextResponse.json({ error: "User and deletion reason are required." }, { status: 400 });
  if (userId === actor.token.uid) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 409 });

  const userRef = adminDb.collection("users").doc(userId);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const user = userSnapshot.data() || {};
  if (user.active !== false || String(user.accountStatus || "").trim().toLowerCase() !== "suspended") {
    return NextResponse.json({ error: "Suspend the account before permanently deleting it." }, { status: 409 });
  }
  const expectedConfirmation = String(user.email || userId).trim().toLowerCase();
  if (confirmation !== expectedConfirmation) {
    return NextResponse.json({ error: "The confirmation value does not match the account email." }, { status: 400 });
  }

  const [ambulancesSnapshot, activeCasesSnapshot] = await Promise.all([
    adminDb.collection("ambulances").get(),
    adminDb.collection("cases").where("assignedUserIds", "array-contains", userId).get(),
  ]);
  const scheduledUnit = ambulancesSnapshot.docs.find((entry) => containsUser({
    assignedUserIds: entry.data().assignedUserIds,
    crewUserIds: entry.data().crewUserIds,
    crewMembers: entry.data().crewMembers,
    shiftCrewAssignments: entry.data().shiftCrewAssignments,
  }, userId));
  if (scheduledUnit) {
    return NextResponse.json(
      { error: `Remove this employee from ambulance ${scheduledUnit.data().code || scheduledUnit.id} and its shifts before deletion.` },
      { status: 409 }
    );
  }
  const activeCase = activeCasesSnapshot.docs.find((entry) =>
    !["closed", "completed", "cancelled", "canceled"].includes(String(entry.data().status || entry.data().dispatchStatus || "").toLowerCase())
  );
  if (activeCase) {
    return NextResponse.json({ error: "This employee is assigned to an active case. Close or reassign it before deletion." }, { status: 409 });
  }

  const projectsSnapshot = await adminDb.collection("projects").get();
  const batch = adminDb.batch();
  projectsSnapshot.docs.forEach((entry) => {
    const data = entry.data();
    const assignedUsers = { ...(data.assignedUsers || {}) };
    const hadAssignedUser = Object.prototype.hasOwnProperty.call(assignedUsers, userId);
    delete assignedUsers[userId];
    const clientUserIds = Array.isArray(data.clientUserIds)
      ? data.clientUserIds.filter((id: string) => id !== userId)
      : [];
    if (hadAssignedUser || clientUserIds.length !== (data.clientUserIds || []).length) {
      batch.update(entry.ref, { assignedUsers, clientUserIds, updatedAt: FieldValue.serverTimestamp() });
    }
  });

  const auditRef = adminDb.collection("deletedUserAudits").doc();
  batch.set(auditRef, {
    deletedUserId: userId,
    deletedUserName: user.name || user.fullNameEn || user.fullNameAr || "",
    deletedUserEmail: user.email || "",
    identityMasked: user.identityMasked || "",
    reason,
    deletedBy: actor.token.uid,
    deletedByName: actor.user.name || actor.token.email || "Administrator",
    deletedAt: FieldValue.serverTimestamp(),
    historicalRecordsPreserved: true,
  });
  if (user.identityHash) {
    const registryRef = adminDb.collection("employeeIdentityRegistry").doc(String(user.identityHash));
    const registrySnapshot = await registryRef.get();
    if (registrySnapshot.data()?.userId === userId) batch.delete(registryRef);
  }
  batch.delete(userRef);
  try {
    await batch.commit();
  } catch (error: any) {
    console.error("Suspended account Firestore deletion failed", { userId, code: error?.code, message: error?.message });
    return NextResponse.json(
      { error: `Account data could not be deleted${error?.code ? ` (${error.code})` : ""}. Please retry or contact system support.` },
      { status: 500 }
    );
  }

  try {
    await adminAuth.deleteUser(userId);
    await auditRef.update({ authenticationAccountDeleted: true });
    return NextResponse.json({ ok: true, auditId: auditRef.id });
  } catch (error: any) {
    if (error?.code === "auth/user-not-found") {
      await auditRef.update({ authenticationAccountDeleted: true, authenticationAccountAlreadyMissing: true });
      return NextResponse.json({ ok: true, auditId: auditRef.id });
    }
    console.error("Suspended account authentication cleanup failed", { userId, code: error?.code, message: error?.message });
    await auditRef.update({
      authenticationAccountDeleted: false,
      authenticationCleanupPending: true,
      authenticationCleanupErrorCode: String(error?.code || "unknown"),
    });
    return NextResponse.json({
      ok: true,
      auditId: auditRef.id,
      warning: "The suspended account was removed from HCAD and its identity was released, but its sign-in record still needs system cleanup.",
    });
  }
}
