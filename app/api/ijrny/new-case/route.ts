export const runtime = "nodejs"; // REQUIRED FIX

import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const API_KEY = process.env.IJRNY_API_KEY;

// -------------------------------------------------------------
// 🔐 AUTHENTICATION CHECK (With Debug Logs)
// -------------------------------------------------------------
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

  const isValid = token === API_KEY;
  console.log("AUTH RESULT:", isValid ? "VALID" : "INVALID");

  return isValid;
}

// -------------------------------------------------------------
// 📌 POST: Create Case from iJrny
// -------------------------------------------------------------
export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid API key" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      IjrnyId,
      chiefComplaint,
      level,
      lat,
      lng,
      locationText,
      patientName,
    } = body;

    if (
      !IjrnyId ||
      !chiefComplaint ||
      !level ||
      lat === undefined ||
      lng === undefined ||
      !locationText ||
      !patientName
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const ref = await addDoc(collection(db, "ijrny_cases"), {
      IjrnyId,
      chiefComplaint,
      level,
      lat,
      lng,
      locationText,
      patientName,
      status: "pending",
      createdAt: serverTimestamp(),
      source: "ijrny",
    });

    return NextResponse.json(
      {
        message: "Case received and saved successfully",
        caseId: ref.id,
        status: "pending",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
