import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =====================================================
   GET ePCR BY CASE ID
   - Used to prevent duplicate ePCRs
   - Returns first matching ePCR (1:1 relationship)
===================================================== */
export async function getEpcrByCaseId(caseId: string) {
  if (!caseId) return null;

  const q = query(
    collection(db, "epcr"),
    where("caseId", "==", caseId)
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  return {
    id: docSnap.id,
    ...docSnap.data(),
  };
}

/* =====================================================
   CREATE ePCR FROM CASE  (FIX OPTION 1)
   - Ensures ONE ePCR per case
   - Stores epcrId inside CASE document
   - Returns epcrId
===================================================== */
export async function createEpcrFromCase(
  caseData: any,
  userId: string
) {
  if (!caseData?.id) {
    throw new Error("caseData is missing");
  }

  const caseId = caseData.id;

  /* ---------------------------------
     1) Check if ePCR already exists
  ---------------------------------- */
  const existingEpcr = await getEpcrByCaseId(caseId);

  if (existingEpcr?.id) {
    // 🔁 Make sure case has epcrId (for old cases)
    await updateDoc(doc(db, "cases", caseId), {
      epcrId: existingEpcr.id,
    });

    return existingEpcr.id;
  }

  /* ---------------------------------
     2) Create new ePCR
  ---------------------------------- */
  const epcrRef = await addDoc(collection(db, "epcr"), {
    // 🔗 relation
    caseId,
    projectId: caseData.projectId ?? null,

    // 📋 snapshot from CASE
    chiefComplaint: caseData.chiefComplaint ?? "",
    triageLevel: caseData.level ?? "",
    locationText: caseData.locationText ?? "",
    lat: caseData.lat ?? null,
    lng: caseData.lng ?? null,

    patient: {
      name: caseData.patientName ?? "",
      age: null,
      gender: null,
    },

    vitals: {
      bp: null,
      hr: null,
      rr: null,
      spo2: null,
      temp: null,
    },

    status: "draft",

    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    completedAt: null,
  });

  /* ---------------------------------
     3) Store epcrId inside CASE
  ---------------------------------- */
  await updateDoc(doc(db, "cases", caseId), {
    epcrId: epcrRef.id,
    epcrCreatedAt: serverTimestamp(),
  });

  return epcrRef.id;
}
