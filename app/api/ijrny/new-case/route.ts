import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const API_KEY = process.env.IJRNY_API_KEY;

// -------------------------------------------------------------
//  🔐 AUTHENTICATION CHECK
// -------------------------------------------------------------
function isAuthorized(req: Request) {
  const key = req.headers.get("authorization");
  if (!key) return false;

  // Expected format:  Bearer supersecretkey123
  const token = key.replace("Bearer ", "").trim();
  return token === API_KEY;
}

// -------------------------------------------------------------
//  📌 POST: Create Case from iJrny
// -------------------------------------------------------------
export async function POST(req: Request) {
  try {
    // -------------------------------
    // 1. Check API key
    // -------------------------------
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid API key" },
        { status: 401 }
      );
    }

    // -------------------------------
    // 2. Parse Request Body
    // -------------------------------
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

    // -------------------------------
    // 3. Validate Required Fields
    // -------------------------------
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

    // -------------------------------
    // 4. Save Case to Firestore
    // -------------------------------
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

    // -------------------------------
    // 5. Return Response
    // -------------------------------
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
