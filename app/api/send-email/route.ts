// app/api/send-email/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { getUserAccountType } from "@/lib/userAccounts";

type RecipientGroup = "OPS" | "SALES";

type SendEmailBody = {
  recipientGroup?: RecipientGroup;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
};

function parseEmails(v?: string): string[] {
  return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((email) => email.includes("@"));
}

function normalizeTo(to?: string | string[]): string[] {
  if (!to) return [];
  const list = Array.isArray(to) ? to : [to];
  return list
    .flatMap((x) => String(x).split(",")) // allow "a@x.com,b@y.com"
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function hasContent(text?: string, html?: string) {
  return Boolean((text && text.trim()) || (html && html.trim()));
}

function isAdminRole(role: string) {
  return ["admin", "super_admin", "superadmin"].includes(role.toLowerCase());
}

async function authenticateSender(req: NextRequest) {
  const match = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const token = await adminAuth.verifyIdToken(match[1]);
    const snapshot = await adminDb.collection("users").doc(token.uid).get();
    if (!snapshot.exists) return null;
    const user = snapshot.data() || {};
    if (user.active === false || getUserAccountType(user) === "client") return null;
    const role = String(user.role || "").trim();
    const isAdmin = isAdminRole(role);
    let transportPermissions: Record<string, boolean> = {};
    if (!isAdmin && role) {
      const roleSnapshot = await adminDb.collection("roles").doc(role).get();
      transportPermissions = roleSnapshot.data()?.permissions?.transport || {};
    }
    const canSendTransportEmail = isAdmin || Object.values(transportPermissions).some(Boolean);
    return canSendTransportEmail ? { uid: token.uid, email: token.email || String(user.email || ""), role, isAdmin, transportPermissions } : null;
  } catch {
    return null;
  }
}

async function enforceRateLimit(uid: string) {
  const ref = adminDb.collection("systemEmailRateLimits").doc(uid);
  const now = Date.now();
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const minuteStart = Number(data.minuteStart || 0);
    const dayKey = new Date(now).toISOString().slice(0, 10);
    const minuteCount = now - minuteStart < 60_000 ? Number(data.minuteCount || 0) : 0;
    const dayCount = data.dayKey === dayKey ? Number(data.dayCount || 0) : 0;
    if (minuteCount >= 10 || dayCount >= 100) return false;
    transaction.set(ref, {
      minuteStart: now - minuteStart < 60_000 ? minuteStart : now,
      minuteCount: minuteCount + 1,
      dayKey,
      dayCount: dayCount + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

export async function POST(req: NextRequest) {
  try {
    const sender = await authenticateSender(req);
    if (!sender) return NextResponse.json({ ok: false, error: "Authentication and transport email permission are required." }, { status: 403 });
    if (!(await enforceRateLimit(sender.uid))) {
      return NextResponse.json({ ok: false, error: "Email rate limit exceeded. Please try again later." }, { status: 429 });
    }
    const body = (await req.json()) as SendEmailBody;

    // ✅ Debug logs (visible in Vercel function logs)
    const { recipientGroup, to, subject, text, html } = body ?? {};
    const groupAllowed = sender.isAdmin ||
      (recipientGroup === "OPS" && Boolean(sender.transportPermissions.create || sender.transportPermissions.ops)) ||
      (recipientGroup === "SALES" && Boolean(sender.transportPermissions.ops || sender.transportPermissions.approve || sender.transportPermissions.assign || sender.transportPermissions.reject));
    if (recipientGroup && !groupAllowed) {
      return NextResponse.json({ ok: false, error: "You do not have permission to email this recipient group." }, { status: 403 });
    }

    // ✅ Validate subject
    if (!subject?.trim() || subject.trim().length > 180) {
      return NextResponse.json({ ok: false, error: "Missing subject" }, { status: 400 });
    }

    // ✅ Validate email content
    if (!hasContent(text, html)) {
      return NextResponse.json(
        { ok: false, error: "Missing email content: provide 'text' or 'html'." },
        { status: 400 }
      );
    }
    if ((text?.length || 0) + (html?.length || 0) > 100_000) {
      return NextResponse.json({ ok: false, error: "Email content is too large." }, { status: 400 });
    }

    // ✅ Resolve recipients: direct 'to' OR group env lists
    let finalTo: string[] = normalizeTo(to);
    if (finalTo.length && !sender.isAdmin) {
      return NextResponse.json({ ok: false, error: "Direct recipients are restricted to administrators." }, { status: 403 });
    }

    if (!finalTo.length && recipientGroup) {
      if (recipientGroup === "OPS") finalTo = parseEmails(process.env.OPS_EMAILS);
      if (recipientGroup === "SALES") finalTo = parseEmails(process.env.SALES_EMAILS);
    }

    if (!finalTo.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing recipients: provide 'to' or valid 'recipientGroup'.",
        },
        { status: 400 }
      );
    }

    // ✅ SMTP config from env
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;
    const finalCc = normalizeTo(body.cc);
    const finalBcc = normalizeTo(body.bcc);
    const internalOnly = [...finalCc, ...finalBcc].every((email) => email.toLowerCase().endsWith("@lazem.sa"));
    if (!sender.isAdmin && !internalOnly) {
      return NextResponse.json({ ok: false, error: "CC and BCC recipients must use the Lazem company domain." }, { status: 403 });
    }
    if (finalTo.length + finalCc.length + finalBcc.length > 25) {
      return NextResponse.json({ ok: false, error: "Too many recipients." }, { status: 400 });
    }

    if (!host || !user || !pass || !from) {
      return NextResponse.json(
        {
          ok: false,
          error: "SMTP env vars are missing (SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM).",
        },
        { status: 500 }
      );
    }

    // ✅ Office365 recommended: STARTTLS on 587
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // 587 => STARTTLS
      auth: { user, pass },
      // Keep TLS minimal & stable. Only relax in dev if needed.
      tls: process.env.NODE_ENV === "development" ? { rejectUnauthorized: false } : undefined,
    });

    // ✅ Optional verify (enable temporarily for troubleshooting)
    // await transporter.verify();

    const info = await transporter.sendMail({
      from,
      to: finalTo.join(","), // stable format
      cc: finalCc.length ? finalCc : undefined,
      bcc: finalBcc.length ? finalBcc : undefined,
      subject: subject.trim(),
      text: text?.trim(),
      html: html?.trim(),
    });

    await adminDb.collection("emailDeliveryLogs").add({
      senderUserId: sender.uid,
      senderEmail: sender.email,
      recipientGroup: recipientGroup || "direct_admin",
      recipients: finalTo,
      cc: finalCc,
      bcc: finalBcc,
      subject: subject.trim(),
      status: "sent",
      messageId: info.messageId,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      sentTo: finalTo,
      messageId: info.messageId,
    });
  } catch (error: any) {
    console.error("[send-email] delivery failed");

    return NextResponse.json(
      {
        ok: false,
        error: "Send failed",
      },
      { status: 500 }
    );
  }
}
