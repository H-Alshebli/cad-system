import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/server/firebaseAdmin";
import { hashEmployeeIdentity, isValidEmployeeIdentity, normalizeEmployeeIdentity } from "@/lib/server/employeeIdentity";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const identity = normalizeEmployeeIdentity(body.identity);
  if (!isValidEmployeeIdentity(identity)) {
    return NextResponse.json({ error: "National ID / Iqama must contain exactly 10 digits." }, { status: 400 });
  }
  const identityHash = hashEmployeeIdentity(identity);
  const registrySnapshot = await adminDb.collection("employeeIdentityRegistry").doc(identityHash).get();
  if (registrySnapshot.exists) {
    return NextResponse.json({ error: "An account already exists for this National ID / Iqama. Contact an administrator to recover it." }, { status: 409 });
  }
  const usersSnapshot = await adminDb.collection("users").get();
  const duplicate = usersSnapshot.docs.some((entry) => {
    const data = entry.data();
    return String(data.identityHash || "") === identityHash || normalizeEmployeeIdentity(data?.crewProfile?.nationalId) === identity;
  });
  if (duplicate) {
    return NextResponse.json({ error: "An account already exists for this National ID / Iqama. Contact an administrator to recover it." }, { status: 409 });
  }
  return NextResponse.json({ available: true });
}
