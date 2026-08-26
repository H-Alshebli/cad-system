import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

type NumberKind = "case" | "epcr";

const CONFIG: Record<
  NumberKind,
  { collection: string; sequenceField: string; numberField: string; prefix: string }
> = {
  case: {
    collection: "cases",
    sequenceField: "caseSequence",
    numberField: "caseNumber",
    prefix: "HCAD",
  },
  epcr: {
    collection: "epcr",
    sequenceField: "epcrSequence",
    numberField: "epcrNumber",
    prefix: "ePCR",
  },
};

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

async function getInitialSequence(kind: NumberKind) {
  const config = CONFIG[kind];
  const collectionRef = adminDb.collection(config.collection);
  const [countSnapshot, latestSnapshot] = await Promise.all([
    collectionRef.count().get(),
    collectionRef.orderBy(config.sequenceField, "desc").limit(1).get(),
  ]);

  const documentCount = Number(countSnapshot.data().count || 0);
  const latestSequence = latestSnapshot.empty
    ? 0
    : Number(latestSnapshot.docs[0].get(config.sequenceField) || 0);

  return Math.max(documentCount, latestSequence);
}

export async function POST(request: NextRequest) {
  const authUser = await authenticate(request);
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userSnapshot = await adminDb.collection("users").doc(authUser.uid).get();
  const userData = userSnapshot.data() || {};
  if (!userSnapshot.exists || userData.active === false) {
    return NextResponse.json({ error: "Active user access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || "") as NumberKind;
  if (!CONFIG[kind]) {
    return NextResponse.json({ error: "Invalid number type." }, { status: 400 });
  }

  const config = CONFIG[kind];
  const counterRef = adminDb.collection("systemCounters").doc(kind);
  // Reconcile with the live collection count on every reservation so records
  // imported from another system are included even if they bypass this API.
  const initialSequence = await getInitialSequence(kind);

  const sequence = await adminDb.runTransaction(async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const storedSequence = counterSnapshot.exists
      ? Number(counterSnapshot.get("current") || 0)
      : 0;
    const nextSequence = Math.max(storedSequence, initialSequence) + 1;

    transaction.set(
      counterRef,
      {
        current: nextSequence,
        prefix: config.prefix,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: authUser.uid,
      },
      { merge: true }
    );

    return nextSequence;
  });

  return NextResponse.json({
    kind,
    sequence,
    number: `${config.prefix}-${sequence}`,
  });
}
