// app/(protected)/transport/emailClient.ts

export type RecipientGroup = "OPS" | "SALES";

export type SendEmailPayload = {
  recipientGroup?: RecipientGroup;
  to?: string | string[];

  subject: string;
  text?: string;
  html?: string;
};

export type SendEmailResponse =
  | { ok: true; sentTo: string[]; messageId?: string }
  | { ok?: false; error: string; debug?: any };

function cleanPayload<T extends Record<string, any>>(payload: T): T {
  // ✅ Only remove undefined/null (do NOT remove empty strings)
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined && v !== null)
  ) as T;
}

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResponse> {
  const cleaned = cleanPayload(payload);

  // ✅ Debug
  console.log("[sendEmail] payload =>", cleaned);

  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleaned),
  });

  const data = (await res.json().catch(() => ({}))) as SendEmailResponse;

  if (!res.ok) {
    console.error("[sendEmail] failed =>", data);
    return {
      ok: false,
      error: (data as any)?.error || `Email failed with status ${res.status}`,
      debug: (data as any)?.debug,
    };
  }

  return data;
}
