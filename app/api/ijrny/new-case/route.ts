import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      caseId,
      lat,
      lng,
      chiefComplaint,
      level,
      locationText,
      patientName
    } = body;

    // ----------------------------
    // 1) SECURITY CHECK
    // ----------------------------
    const authHeader = req.headers.get("authorization");
    const apiKey = authHeader?.replace("Bearer ", "");

    if (!apiKey || apiKey !== process.env.IJRNY_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ----------------------------
    // 2) VALIDATION
    // ----------------------------
    if (!caseId || !lat || !lng || !chiefComplaint || !level) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ----------------------------
    // 3) CREATE CASE IN FIRESTORE
    // ----------------------------
    const newCase = {
      Ijrny: caseId,
      patientName: patientName || "",
      chiefComplaint,
      level,
      locationText: locationText || "",
      lat,
      lng,
      status: "Received",
      createdAt: serverTimestamp(),
      timeline: {
        Received: new Date().toISOString()
      }
    };

    const docRef = await addDoc(collection(db, "cases"), newCase);

    // Create return case ID (optional)
    const lazCaseId = docRef.id;

    return NextResponse.json(
      {
        status: "success",
        message: "Case created successfully",
        lazCaseId
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { error: "Server Error", details: error.message },
      { status: 500 }
    );
  }
}
