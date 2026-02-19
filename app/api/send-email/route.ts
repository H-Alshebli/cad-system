// app/api/send-email/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

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
    .filter((email) => email.includes("@"));
}

function hasContent(text?: string, html?: string) {
  return Boolean((text && text.trim()) || (html && html.trim()));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SendEmailBody;

    // ✅ Debug logs (visible in Vercel function logs)
    console.log("[send-email] body =>", {
      recipientGroup: body?.recipientGroup,
      to: body?.to,
      subject: body?.subject,
      hasText: Boolean(body?.text && body.text.trim()),
      hasHtml: Boolean(body?.html && body.html.trim()),
    });

    const { recipientGroup, to, subject, text, html } = body ?? {};

    // ✅ Validate subject
    if (!subject?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing subject" }, { status: 400 });
    }

    // ✅ Validate email content
    if (!hasContent(text, html)) {
      return NextResponse.json(
        { ok: false, error: "Missing email content: provide 'text' or 'html'." },
        { status: 400 }
      );
    }

    // ✅ Resolve recipients: direct 'to' OR group env lists
    let finalTo: string[] = normalizeTo(to);
    

    if (!finalTo.length && recipientGroup) {
      if (recipientGroup === "OPS") finalTo = parseEmails(process.env.OPS_EMAILS);
      if (recipientGroup === "SALES") finalTo = parseEmails(process.env.SALES_EMAILS);
    }

    if (!finalTo.length) {
      return NextResponse.json(
        {
          ok: false,
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
    const finalCc = normalizeTo(body.cc);
    const finalBcc = normalizeTo(body.bcc);

    console.log("[send-email] FINAL RECIPIENTS =>", {
  to: finalTo,
  cc: finalCc,
  bcc: finalBcc,
});


    if (!host || !user || !pass || !from) {
      return NextResponse.json(
        {
          ok: false,
          error: "SMTP env vars are missing (SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_FROM).",
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

    return NextResponse.json({
      ok: true,
      sentTo: finalTo,
      messageId: info.messageId,
    });
  } catch (e: any) {
    console.error("[send-email] error =>", e);

    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Send failed",
        debug: {
          code: e?.code,
          command: e?.command,
          responseCode: e?.responseCode,
          response: e?.response,
          hostname: e?.hostname,
        },
      },
      { status: 500 }
    );
  }
}
