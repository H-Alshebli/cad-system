// app/(protected)/transport/emailClient.ts

export type RecipientGroup = "OPS" | "SALES";

type SendEmailPayload = {
  // Either send to directly OR use a group
  to?: string | string[];
  recipientGroup?: RecipientGroup;

  subject: string;
  text?: string;
  html?: string;
};

// Put your group emails here (or move them to env later)
const GROUP_EMAILS: Record<RecipientGroup, string[]> = {
  OPS: ["h.alshebli@lazem.sa"],     // 🔁 عدّلها
  SALES: ["support@lazem.sa"], // 🔁 عدّلها
};

function normalizeTo(to: string | string[]) {
  return Array.isArray(to) ? to : [to];
}

// app/(protected)/transport/emailClient.ts




export async function sendEmail(payload:
  | { recipientGroup: RecipientGroup; subject: string; text?: string; html?: string }
  | { to: string | string[]; subject: string; text?: string; html?: string }
) {
  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Email failed");
  return data;
}

