import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const DISPATCH_ROLES = new Set([
  "admin",
  "super_admin",
  "superadmin",
  "management",
  "dispatch",
  "dispatcher",
]);

function normalize(value: unknown) {
  return String(value || "").trim();
}

function normalizeRole(value: unknown) {
  return normalize(value).toLowerCase();
}

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

async function roleAllowsInternalChat(role: string) {
  if (DISPATCH_ROLES.has(normalizeRole(role))) return true;
  const roleSnapshot = await adminDb.collection("roles").doc(role).get();
  return roleSnapshot.get("permissions.cad.internal_chat") === true;
}

function collectCrewUserIds(caseData: Record<string, any>) {
  return new Set<string>(
    [
      ...(Array.isArray(caseData.assignedUserIds) ? caseData.assignedUserIds : []),
      ...(Array.isArray(caseData.assignedCrewUserIds) ? caseData.assignedCrewUserIds : []),
    ]
      .map(normalize)
      .filter(Boolean)
  );
}

async function addAmbulanceCrew(
  caseData: Record<string, any>,
  crewUserIds: Set<string>
) {
  const ambulanceId = normalize(
    caseData.assignedUnit?.id || caseData.assignedAmbulanceId || caseData.ambulanceId
  );
  if (!ambulanceId) return;

  const ambulanceSnapshot = await adminDb.collection("ambulances").doc(ambulanceId).get();
  if (!ambulanceSnapshot.exists) return;

  const ambulance = ambulanceSnapshot.data() || {};
  for (const userId of [
    ...(Array.isArray(ambulance.crewUserIds) ? ambulance.crewUserIds : []),
    ...(Array.isArray(ambulance.assignedUserIds) ? ambulance.assignedUserIds : []),
    ...(Array.isArray(ambulance.crewMembers)
      ? ambulance.crewMembers.map((member: any) => member?.userId)
      : []),
  ]) {
    const normalized = normalize(userId);
    if (normalized) crewUserIds.add(normalized);
  }
}

async function getActiveDispatchUserIds() {
  const usersSnapshot = await adminDb.collection("users").get();
  return usersSnapshot.docs
    .filter((document) => {
      const data = document.data();
      return data.active !== false && DISPATCH_ROLES.has(normalizeRole(data.role));
    })
    .map((document) => document.id);
}

export async function POST(request: NextRequest) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const caseId = normalize(body.caseId);
  const message = normalize(body.message);
  if (!caseId || !message) {
    return NextResponse.json({ error: "Case and message are required." }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Message must not exceed 2,000 characters." }, { status: 400 });
  }

  const [userSnapshot, caseSnapshot] = await Promise.all([
    adminDb.collection("users").doc(authUser.uid).get(),
    adminDb.collection("cases").doc(caseId).get(),
  ]);
  const userData = userSnapshot.data() || {};
  const caseData = caseSnapshot.data() || {};
  if (!userSnapshot.exists || userData.active === false) {
    return NextResponse.json({ error: "Active user access is required." }, { status: 403 });
  }
  if (!caseSnapshot.exists || caseData.isArchived === true) {
    return NextResponse.json({ error: "Case was not found." }, { status: 404 });
  }

  const senderRole = normalize(userData.role);
  const crewUserIds = collectCrewUserIds(caseData);
  await addAmbulanceCrew(caseData, crewUserIds);
  const isAssignedCrew = crewUserIds.has(authUser.uid);
  const hasChatPermission = await roleAllowsInternalChat(senderRole);
  if (!hasChatPermission && !isAssignedCrew) {
    return NextResponse.json({ error: "Internal chat access is required." }, { status: 403 });
  }

  const isDispatchSender = DISPATCH_ROLES.has(normalizeRole(senderRole));
  const recipientUserIds = isDispatchSender
    ? Array.from(crewUserIds)
    : await getActiveDispatchUserIds();
  const recipients = Array.from(
    new Set(recipientUserIds.map(normalize).filter((userId) => userId && userId !== authUser.uid))
  );

  const senderName =
    normalize(userData.name || userData.fullName || userData.email) || "HCAD User";
  const caseNumber = normalize(caseData.caseNumber) || `HCAD-${caseId.slice(0, 6).toUpperCase()}`;
  const messageRef = adminDb.collection("cases").doc(caseId).collection("chat").doc();
  const notificationRef = adminDb.collection("notifications").doc(`chat_${caseId}_${messageRef.id}`);
  const batch = adminDb.batch();

  batch.create(messageRef, {
    message,
    senderId: authUser.uid,
    senderName,
    senderRole: senderRole || "unknown",
    recipientUserIds: recipients,
    createdAt: FieldValue.serverTimestamp(),
  });

  batch.update(caseSnapshot.ref, {
    lastChatMessage: {
      id: messageRef.id,
      senderId: authUser.uid,
      senderName,
      senderRole: senderRole || "unknown",
      recipientUserIds: recipients,
      messagePreview: message.slice(0, 120),
      createdAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (recipients.length > 0) {
    batch.create(notificationRef, {
      type: "chat_message",
      caseId,
      caseNumber,
      projectName: normalize(caseData.projectName || caseData.assignedProjectName),
      senderId: authUser.uid,
      senderName,
      senderRole: senderRole || "unknown",
      recipientUserIds: recipients,
      readByUserIds: [],
      title: `New message for ${caseNumber}`,
      message: `New message from ${senderName}`,
      messagePreview: message.slice(0, 120),
      link: `/cadcases/${caseId}`,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return NextResponse.json({ ok: true, messageId: messageRef.id, notified: recipients.length });
}
