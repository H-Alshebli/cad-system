export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/packages/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const API_KEY = process.env.IJRNY_API_KEY;

function isAuthorized(req: Request) {
  const key = req.headers.get("authorization");
  console.log("CLIENT Authorization Header:", key);

  if (!key) {
    console.log("AUTH RESULT: No Authorization header found.");
    return false;
  }

  const token = key.replace("Bearer ", "").trim();
  console.log("Extracted TOKEN:", token);
  console.log("ENV IJRNY_API_KEY:", API_KEY);

  const valid = token === API_KEY;
  console.log("AUTH RESULT:", valid ? "VALID" : "INVALID");

  return valid;
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

  } catch (err) {
    console.error("API ERROR:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
