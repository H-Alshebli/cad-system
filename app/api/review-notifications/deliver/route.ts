import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { deliverReviewNotifications } from "@/lib/server/reviewNotificationDelivery";
export const runtime = "nodejs";
// Dedicated scheduler credential, not a user's token; configure through secrets.
export async function POST(request: NextRequest) {
  const expected = process.env.REVIEW_NOTIFICATION_WORKER_SECRET || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (expected.length < 32 || !timingSafeEqual(hash(expected), hash(supplied))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await deliverReviewNotifications()); }
  catch { return NextResponse.json({ error: "Delivery worker failed; inspect queue status before retrying." }, { status: 500 }); }
}
