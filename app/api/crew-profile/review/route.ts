import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  getCrewProfileCompletion,
  getCrewProfileRequirementMode,
  getCrewProfileValues,
} from "@/lib/crewProfile";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

async function authenticateReviewer(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const reviewerSnapshot = await adminDb.collection("users").doc(token.uid).get();
    if (!reviewerSnapshot.exists) return null;
    const reviewer = reviewerSnapshot.data() || {};
    const role = String(reviewer.role || "").trim();
    const normalizedRole = role.toLowerCase();
    let allowed = /admin|human resources|\bhr\b/.test(normalizedRole);

    if (!allowed && role) {
      const roleSnapshot = await adminDb.collection("roles").doc(role).get();
      const permissions = roleSnapshot.data()?.permissions || {};
      allowed = Boolean(permissions?.crew_profile?.edit_all);
    }

    return allowed ? { token, reviewer } : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await authenticateReviewer(request);
  if (!authenticated) {
    return NextResponse.json({ error: "HR or Admin permission is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId || "").trim();
  const action = String(body.action || "").trim();
  const notes = String(body.notes || "").trim();
  if (!userId || !new Set(["verify", "request_changes", "reopen", "reject_update", "update_contract", "update_employee_id"]).has(action)) {
    return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
  }
  if (action === "request_changes" && !notes) {
    return NextResponse.json({ error: "Please enter the required changes." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(userId);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    return NextResponse.json({ error: "Crew profile not found." }, { status: 404 });
  }

  if (action === "update_employee_id") {
    const employeeId = String(body.employeeId || "").trim();
    if (!employeeId) {
      return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
    }
    if (employeeId.length > 40 || /[\u0000-\u001F\u007F]/.test(employeeId)) {
      return NextResponse.json({ error: "Invalid Employee ID." }, { status: 400 });
    }

    const [topLevelMatches, profileMatches] = await Promise.all([
      adminDb.collection("users").where("employeeId", "==", employeeId).limit(2).get(),
      adminDb
        .collection("users")
        .where("crewProfile.employeeId", "==", employeeId)
        .limit(2)
        .get(),
    ]);
    const conflictingUser = [...topLevelMatches.docs, ...profileMatches.docs].find(
      (document) => document.id !== userId
    );
    if (conflictingUser) {
      return NextResponse.json(
        { error: "This Employee ID is already assigned to another employee." },
        { status: 409 }
      );
    }

    const targetUser = userSnapshot.data() || {};
    const currentProfile = targetUser.crewProfile || {};
    const previousEmployeeId = String(
      currentProfile.employeeId || targetUser.employeeId || ""
    ).trim();
    const reviewerName =
      authenticated.reviewer.name ||
      authenticated.reviewer.displayName ||
      authenticated.token.email ||
      "HR Reviewer";

    await userRef.update({
      employeeId,
      crewProfile: { ...currentProfile, employeeId },
      crewProfileUpdatedAt: FieldValue.serverTimestamp(),
      profileUpdatedAt: FieldValue.serverTimestamp(),
      crewProfileReviewHistory: FieldValue.arrayUnion({
        action,
        actorId: authenticated.token.uid,
        actorName: reviewerName,
        actorEmail: authenticated.token.email || "",
        previousEmployeeId,
        employeeId,
        at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ employeeId });
  }


  if (action === "update_contract") {
    const contractEndDate = String(body.contractEndDate || "").trim();
    if (contractEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(contractEndDate)) {
      return NextResponse.json({ error: "Invalid contract end date." }, { status: 400 });
    }
    const currentProfile = userSnapshot.data()?.crewProfile || {};
    await userRef.update({
      crewProfile: { ...currentProfile, contractEndDate },
      crewProfileUpdatedAt: FieldValue.serverTimestamp(),
      profileUpdatedAt: FieldValue.serverTimestamp(),
      crewProfileReviewHistory: FieldValue.arrayUnion({
        action,
        actorId: authenticated.token.uid,
        actorEmail: authenticated.token.email || "",
        contractEndDate,
        at: new Date().toISOString(),
      }),
    });
    return NextResponse.json({ status: userSnapshot.data()?.crewProfileReviewStatus || "draft" });
  }

  if (action === "verify") {
    const targetUser = userSnapshot.data() || {};
    const completion = getCrewProfileCompletion(
      getCrewProfileValues(targetUser),
      targetUser.crewProfileAttachments || {},
      getCrewProfileRequirementMode(targetUser)
    );
    if (
      completion.missing.length ||
      completion.pendingVerification.length ||
      completion.rejected.length ||
      !completion.isMappedJobTitle
    ) {
      return NextResponse.json(
        { error: "Complete and verify all required profile items before approval." },
        { status: 409 }
      );
    }
  }

  const nextStatus =
    action === "verify"
      ? "verified"
      : action === "request_changes"
      ? "changes_required"
      : action === "reopen"
      ? "reopened"
      : "verified";
  const reviewerName =
    authenticated.reviewer.name ||
    authenticated.reviewer.displayName ||
    authenticated.token.email ||
    "HR Reviewer";

  await userRef.update({
    crewProfileReviewStatus: nextStatus,
    crewProfileReviewNotes: notes,
    crewProfileReviewedAt: FieldValue.serverTimestamp(),
    crewProfileReviewedBy: authenticated.token.uid,
    crewProfileReviewerName: reviewerName,
    crewProfileReviewerEmail: authenticated.token.email || "",
    crewProfileUpdatedAt: FieldValue.serverTimestamp(),
    ...(action === "verify"
      ? { crewProfileVerifiedAt: FieldValue.serverTimestamp() }
      : {}),
    ...(action === "reopen"
      ? {
          crewProfileUpdateRequestReason: "",
          crewProfileUpdateRequestedAt: null,
        }
      : {}),
    crewProfileReviewHistory: FieldValue.arrayUnion({
      action,
      actorId: authenticated.token.uid,
      actorName: reviewerName,
      actorEmail: authenticated.token.email || "",
      notes,
      at: new Date().toISOString(),
    }),
  });

  return NextResponse.json({ status: nextStatus });
}
