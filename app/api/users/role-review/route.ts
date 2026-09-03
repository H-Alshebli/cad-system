import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import {
  getCrewProfileCompletion,
  getCrewProfileValues,
} from "@/lib/crewProfile";

export const runtime = "nodejs";

function fullProfileSummary(user: Record<string, any>) {
  const completion = getCrewProfileCompletion(
    getCrewProfileValues(user),
    user.crewProfileAttachments || {},
    "full"
  );
  return {
    crewProfileRequirementMode: "full",
    crewProfileCompletion: completion.percent,
    crewProfileMissingFields: completion.missing.map((field) => field.key),
    crewProfilePendingVerificationFields: completion.pendingVerification.map((field) => field.key),
    crewProfileRejectedFields: completion.rejected.map((field) => field.key),
    crewProfileExpiredFields: completion.expired.map((field) => field.key),
    crewProfileExpiringSoonFields: completion.expiringSoon.map((field) => field.key),
    crewProfileStatus: completion.status,
    crewProfileComplianceStatus: completion.complianceStatus,
    crewProfileIsComplete: completion.isComplete,
    crewProfileIsCompliant: completion.isCompliant,
  };
}

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const snapshot = await adminDb.collection("users").doc(token.uid).get();
    if (!snapshot.exists) return null;
    const reviewer = snapshot.data() || {};
    const role = String(reviewer.role || "").trim();
    const normalizedRole = role.toLowerCase();
    let allowed = /admin|human resources|\bhr\b/.test(normalizedRole);
    if (!allowed && role) {
      const roleSnapshot = await adminDb.collection("roles").doc(role).get();
      allowed = roleSnapshot.data()?.permissions?.users?.edit === true;
    }
    return allowed ? { token, reviewer } : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await authenticate(request);
  if (!authenticated) {
    return NextResponse.json({ error: "User Management edit permission is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId || "").trim();
  const action = String(body.action || "").trim();
  const selectedRole = String(body.role || "").trim();
  const note = String(body.note || "").trim();
  if (action === "upgrade_active_profiles_to_full") {
    const snapshot = await adminDb.collection("users").where("active", "==", true).get();
    const eligible = snapshot.docs.filter((entry) => {
      const data = entry.data();
      return data.accountType !== "client" && data.crewProfileRequirementMode !== "full";
    });
    for (let index = 0; index < eligible.length; index += 400) {
      const batch = adminDb.batch();
      eligible.slice(index, index + 400).forEach((entry) => {
        const data = entry.data();
        batch.update(entry.ref, {
          ...fullProfileSummary(data),
          profileUpdatedAt: FieldValue.serverTimestamp(),
          profileRequirementUpgradedAt: FieldValue.serverTimestamp(),
          profileRequirementUpgradedBy: authenticated.token.uid,
        });
      });
      await batch.commit();
    }
    return NextResponse.json({ ok: true, updated: eligible.length });
  }

  if (!userId || !new Set(["approve", "request_changes", "reject", "suspend", "activate"]).has(action)) {
    return NextResponse.json({ error: "Invalid role review action." }, { status: 400 });
  }
  if (action === "request_changes" && !note) {
    return NextResponse.json({ error: "Please enter the required changes." }, { status: 400 });
  }
  if (action === "approve") {
    if (!selectedRole) return NextResponse.json({ error: "Select a role first." }, { status: 400 });
    const roleSnapshot = await adminDb.collection("roles").doc(selectedRole).get();
    if (!roleSnapshot.exists) {
      return NextResponse.json({ error: "The selected role does not exist." }, { status: 409 });
    }
  }

  const userRef = adminDb.collection("users").doc(userId);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const target = userSnapshot.data() || {};
  const reviewerName =
    authenticated.reviewer.name ||
    authenticated.reviewer.displayName ||
    authenticated.token.email ||
    "User Manager";
  const common = {
    roleReviewedAt: FieldValue.serverTimestamp(),
    roleReviewedBy: authenticated.token.uid,
    roleReviewerName: reviewerName,
    roleReviewNote: note,
    updatedAt: FieldValue.serverTimestamp(),
    roleReviewHistory: FieldValue.arrayUnion({
      action,
      previousRole: target.role || "",
      selectedRole,
      note,
      actorId: authenticated.token.uid,
      actorName: reviewerName,
      actorEmail: authenticated.token.email || "",
      at: new Date().toISOString(),
    }),
  };

  if (action === "approve") {
    await userRef.update({
      ...common,
      role: selectedRole,
      approvedRole: selectedRole,
      roleRequestStatus: "approved",
      active: true,
      accountStatus: "active",
      ...fullProfileSummary(target),
    });
  } else if (action === "request_changes") {
    await userRef.update({ ...common, roleRequestStatus: "changes_requested" });
  } else if (action === "reject") {
    await userRef.update({ ...common, roleRequestStatus: "rejected", active: false, accountStatus: "pending" });
  } else if (action === "suspend") {
    await userRef.update({ ...common, active: false, accountStatus: "suspended" });
  } else {
    await userRef.update({
      ...common,
      active: true,
      accountStatus: "active",
      ...(target.accountType !== "client" ? fullProfileSummary(target) : {}),
    });
  }

  return NextResponse.json({ ok: true });
}
