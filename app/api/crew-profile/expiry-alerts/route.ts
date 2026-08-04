export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/server/firebaseAdmin";
import {
  buildCrewExpiryAlertId,
  CrewExpiryThreshold,
  getCrewExpiryCandidates,
} from "@/lib/crewExpiryAlerts";
import { getCrewProfileValues } from "@/lib/crewProfile";

function splitEmails(value?: string) {
  return String(value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
}

function normalize(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function isCrewUser(user: Record<string, any>) {
  const values = getCrewProfileValues(user);
  if (String(values.jobTitle || "").trim()) return true;
  const role = normalize(user.role);
  return /crew|paramedic|emt|nurse|physician|doctor|ambulance|driver|dispatcher|ccc|medical[_ ]team/.test(
    role
  );
}

function isHrUser(user: Record<string, any>) {
  const role = normalize(user.role).replace(/[_-]+/g, " ");
  return /(^| )(hr|human resources?)( |$)/.test(role);
}

function requestIsAuthorized(request: Request) {
  const secret =
    process.env.CREW_EXPIRY_CRON_SECRET || process.env.CRON_SECRET || "";
  if (!secret) return false;
  const authorization = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) return null;

  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user, pass },
      tls:
        process.env.NODE_ENV === "development"
          ? { rejectUnauthorized: false }
          : undefined,
    }),
  };
}

async function runExpiryAlerts(request: Request) {
  if (!requestIsAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const usersSnapshot = await adminDb.collection("users").get();
  const users: Array<Record<string, any> & { id: string }> =
    usersSnapshot.docs.map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    }));
  const hrUsers = users.filter(isHrUser);
  const configuredHrEmails = splitEmails(process.env.HR_EMAILS);
  const mail = createTransporter();
  const today = new Date();
  let created = 0;
  let duplicates = 0;
  let emailsSent = 0;
  let emailFailures = 0;

  for (const crewUser of users.filter(isCrewUser)) {
    const values = getCrewProfileValues(crewUser);
    const supervisorReference = normalize(values.supervisorName);
    const supervisor = supervisorReference
      ? users.find(
          (candidate) =>
            normalize(candidate.name) === supervisorReference ||
            normalize(candidate.email) === supervisorReference
        )
      : undefined;
    const recipientUserIds = Array.from(
      new Set(
        [crewUser.id, supervisor?.id, ...hrUsers.map((user) => user.id)].filter(
          Boolean
        ) as string[]
      )
    );
    const recipientEmails = Array.from(
      new Set(
        [
          crewUser.email,
          supervisor?.email,
          ...hrUsers.map((user) => user.email),
          ...configuredHrEmails,
        ]
          .map((email) => normalize(email))
          .filter((email) => email.includes("@"))
      )
    );

    for (const candidate of getCrewExpiryCandidates(crewUser, today)) {
      for (const threshold of candidate.dueThresholds) {
        const alertId = buildCrewExpiryAlertId(
          crewUser.id,
          candidate.fieldKey,
          candidate.expiryDate,
          threshold as CrewExpiryThreshold
        );
        const alertRef = adminDb.collection("crewExpiryAlerts").doc(alertId);
        const notificationRef = adminDb.collection("notifications").doc(alertId);
        const title = `${candidate.fieldLabel} expires within ${threshold} days`;
        const message = `${crewUser.name || crewUser.email || crewUser.id}: ${
          candidate.fieldLabel
        } expires on ${candidate.expiryDate} (${candidate.daysRemaining} days remaining).`;

        const claimed = await adminDb.runTransaction(async (transaction) => {
          const existing = await transaction.get(alertRef);
          if (existing.exists) return false;

          const basePayload = {
            type: "crew_expiry",
            crewUserId: crewUser.id,
            crewName: crewUser.name || crewUser.email || crewUser.id,
            fieldKey: candidate.fieldKey,
            fieldLabel: candidate.fieldLabel,
            expiryDate: candidate.expiryDate,
            daysRemaining: candidate.daysRemaining,
            threshold,
            recipientUserIds,
            recipientEmails,
            title,
            message,
            link: "/crew-profile",
            createdAt: FieldValue.serverTimestamp(),
          };

          transaction.create(alertRef, {
            ...basePayload,
            emailStatus: mail ? "pending" : "skipped_not_configured",
          });
          transaction.create(notificationRef, {
            ...basePayload,
            readByUserIds: [],
          });
          return true;
        });

        if (!claimed) {
          duplicates += 1;
          continue;
        }

        created += 1;
        if (!mail || !recipientEmails.length) continue;

        try {
          const info = await mail.transporter.sendMail({
            from: mail.from,
            to: recipientEmails,
            subject: `[HCAD] ${title}`,
            text: `${message}\n\nOpen HCAD Crew Profiles to review the document and renewal status.`,
          });
          emailsSent += 1;
          await alertRef.update({
            emailStatus: "sent",
            emailMessageId: info.messageId,
            emailSentAt: FieldValue.serverTimestamp(),
          });
        } catch (error: any) {
          emailFailures += 1;
          await alertRef.update({
            emailStatus: "failed",
            emailError: String(error?.message || error),
            emailFailedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scannedCrew: users.filter(isCrewUser).length,
    created,
    duplicates,
    emailsSent,
    emailFailures,
    smtpConfigured: Boolean(mail),
  });
}

export async function GET(request: Request) {
  return runExpiryAlerts(request);
}

export async function POST(request: Request) {
  return runExpiryAlerts(request);
}
