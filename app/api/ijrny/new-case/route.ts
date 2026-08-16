export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const API_KEY = process.env.IJRNY_API_KEY;

function isAuthorized(req: Request) {
  const key = req.headers.get("authorization");

  if (!key) {
    return false;
  }

  const token = key.replace("Bearer ", "").trim();
  return Boolean(API_KEY) && token === API_KEY;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized: Invalid API key" }, { status: 401 });
    }

    const body = await req.json();

    const ref = await addDoc(collection(db, "ijrny_cases"), {
      ...body,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    return NextResponse.json(
      { message: "Case saved", id: ref.id },
      { status: 201 }
    );

  } catch {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
