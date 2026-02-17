// app/api/send-email/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type RecipientGroup = "OPS" | "SALES";

type SendEmailBody = {
  recipientGroup?: RecipientGroup;
  to?: string | string[];
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
    .filter((email) => email.includes("@"));
}

function hasContent(text?: string, html?: string) {
  return Boolean((text && text.trim()) || (html && html.trim()));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendEmailBody;

    // ✅ Debug logs (visible in Vercel function logs)
    console.log("[send-email] body =>", body);

    const { recipientGroup, to, subject, text, html } = body ?? {};

    // ✅ Validate subject
    if (!subject?.trim()) {
      return NextResponse.json(
        { error: "Missing subject" },
        { status: 400 }
      );
    }

    // ✅ Validate email content
    if (!hasContent(text, html)) {
      return NextResponse.json(
        { error: "Missing email content: provide 'text' or 'html'." },
        { status: 400 }
      );
    }

    // ✅ Resolve recipients: direct 'to' OR group
    let finalTo: string[] = normalizeTo(to);

    if (!finalTo.length && recipientGroup) {
      if (recipientGroup === "OPS") finalTo = parseEmails(process.env.OPS_EMAILS);
      if (recipientGroup === "SALES") finalTo = parseEmails(process.env.SALES_EMAILS);
    }

    if (!finalTo.length) {
      return NextResponse.json(
        {
          error: "Missing recipients: provide 'to' or valid 'recipientGroup'.",
          debug: {
            recipientGroup,
            to,
            opsEnvLoaded: Boolean(process.env.OPS_EMAILS),
            salesEnvLoaded: Boolean(process.env.SALES_EMAILS),
          },
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

    if (!host || !user || !pass || !from) {
      return NextResponse.json(
        {
          error:
            "SMTP env vars are missing (SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM).",
          debug: {
            hasHost: Boolean(host),
            hasUser: Boolean(user),
            hasPass: Boolean(pass),
            hasFrom: Boolean(from),
          },
        },
        { status: 500 }
      );
    }

    // ✅ Office365 (smtp.office365.com) recommended: STARTTLS on 587
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // 587 => STARTTLS
      auth: { user, pass },
      // ✅ Usually not required. Keep it minimal & stable.
      // If you ever face SSL/cert issues locally only, you can enable dev-only tls override.
      tls:
        process.env.NODE_ENV === "development"
          ? { rejectUnauthorized: false }
          : undefined,
    });

    // Optional: verify SMTP connection (useful in dev)
    // await transporter.verify();

    const info = await transporter.sendMail({
      from,
      to: finalTo.join(","), // stable format
      subject: subject.trim(),
      text: text?.trim(),
      html: html?.trim(),
    });

    return NextResponse.json({
      ok: true,
      sentTo: finalTo,
      messageId: info.messageId,
    });
  } catch (e: any) {
    console.error("[send-email] error =>", e);

    const msg =
      e?.response?.toString?.() ||
      e?.message ||
      "Send failed";

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
