import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  CrewProfileAttachments,
  CrewProfileValues,
  getCrewProfileCompletion,
  getCrewProfileRequirementMode,
} from "@/lib/crewProfile";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const EDITABLE_STATUSES = new Set(["", "draft", "changes_required", "reopened"]);

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    return await adminAuth.verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

function profileSummary(
  profile: CrewProfileValues,
  attachments: CrewProfileAttachments,
  requirementMode: "temporary" | "full"
) {
  const completion = getCrewProfileCompletion(profile, attachments, requirementMode);
  return {
    crewProfileCompletion: completion.percent,
    crewProfileMissingFields: completion.missing.map((field) => field.key),
    crewProfilePendingVerificationFields: completion.pendingVerification.map(
      (field) => field.key
    ),
    crewProfileRejectedFields: completion.rejected.map((field) => field.key),
    crewProfileExpiredFields: completion.expired.map((field) => field.key),
    crewProfileExpiringSoonFields: completion.expiringSoon.map((field) => field.key),
    crewProfileStatus: completion.status,
    crewProfileComplianceStatus: completion.complianceStatus,
    crewProfileIsComplete: completion.isComplete,
    crewProfileIsCompliant: completion.isCompliant,
    completion,
  };
}

export async function POST(request: NextRequest) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(authUser.uid);
  const snapshot = await userRef.get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }

  const user = snapshot.data() || {};
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const currentStatus = String(user.crewProfileReviewStatus || "draft");

  if (action === "request_update") {
    if (!new Set(["submitted", "verified", "update_requested"]).has(currentStatus)) {
      return NextResponse.json(
        { error: "This profile does not require an unlock request." },
        { status: 409 }
      );
    }

    const reason = String(body.reason || "").trim();
    if (!reason) {
      return NextResponse.json({ error: "Please provide a reason." }, { status: 400 });
    }

    await userRef.update({
      crewProfileReviewStatus: "update_requested",
      crewProfileUpdateRequestReason: reason,
      crewProfileUpdateRequestedAt: FieldValue.serverTimestamp(),
      crewProfileUpdatedAt: FieldValue.serverTimestamp(),
      crewProfileReviewHistory: FieldValue.arrayUnion({
        action: "update_requested",
        actorId: authUser.uid,
        actorEmail: authUser.email || "",
        reason,
        at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ status: "update_requested" });
  }

  if (!EDITABLE_STATUSES.has(currentStatus)) {
    return NextResponse.json(
      { error: "This profile is locked. Request HR approval before editing." },
      { status: 423 }
    );
  }

  if (action !== "save_draft" && action !== "submit") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const crewProfile = (body.crewProfile || {}) as CrewProfileValues;
  const attachments = (user.crewProfileAttachments || {}) as CrewProfileAttachments;
  const requirementMode = getCrewProfileRequirementMode(user);
  const { completion, ...summary } = profileSummary(
    crewProfile,
    attachments,
    requirementMode
  );

  if (action === "submit" && (completion.missing.length || !completion.isMappedJobTitle)) {
    return NextResponse.json(
      {
        error: "Complete all required fields before submitting.",
        missingFields: completion.missing.map((field) => field.label),
      },
      { status: 400 }
    );
  }

  const fullNameEn = String(body.fullNameEn || "").trim();
  const fullNameAr = String(body.fullNameAr || "").trim();
  const nextStatus = action === "submit" ? "submitted" : currentStatus || "draft";
  const nowIso = new Date().toISOString();

  await userRef.update({
    crewProfile,
    ...summary,
    crewProfileReviewStatus: nextStatus,
    crewProfileUpdatedAt: FieldValue.serverTimestamp(),
    profileUpdatedAt: FieldValue.serverTimestamp(),
    ...(action === "submit"
      ? {
          crewProfileSubmittedAt: FieldValue.serverTimestamp(),
          crewProfileSubmittedBy: authUser.uid,
          crewProfileReviewNotes: "",
        }
      : {}),
    crewProfileReviewHistory: FieldValue.arrayUnion({
      action,
      actorId: authUser.uid,
      actorEmail: authUser.email || "",
      at: nowIso,
    }),
    name: fullNameEn || fullNameAr || user.name || authUser.email || "",
    fullNameEn,
    fullNameAr,
    employeeId: crewProfile.employeeId || user.employeeId || "",
    mobile:
      [crewProfile.mobileCountryCode, crewProfile.mobile].filter(Boolean).join(" ") ||
      user.mobile ||
      "",
    iban: crewProfile.iban || "",
  });

  return NextResponse.json({
    status: nextStatus,
    completion: completion.percent,
  });
}
