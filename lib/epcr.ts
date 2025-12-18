import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

 
/* ===============================
   CREATE ePCR
================================ */
export async function createEpcrFromCase(caseData: any, userId: string) {
  const docRef = await addDoc(collection(db, "epcr"), {
    caseId: caseData.id,
    lazemCaseCode: caseData.lazemCode,
    ambulanceId: caseData.ambulanceId || null,
 
    status: "draft",
 
    patient: {
      name: null,
      age: null,
      gender: null,
    },
 
    chiefComplaint: caseData.chiefComplaint || null,
    triageLevel: caseData.level || null,
 
    vitals: {
      bp: null,
      hr: null,
      rr: null,
      spo2: null,
      temp: null,
    },
 
    assessment: null,
    treatment: null,
    outcome: null,
 
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: null,
    completedAt: null,
  });
 
  return docRef.id;
}
 
/* ===============================
   GET ePCR BY CASE ID
================================ */
export async function getEpcrByCaseId(caseId: string) {
  const q = query(
    collection(db, "epcr"),
    where("caseId", "==", caseId)
  );
 
  const snap = await getDocs(q);
 
  if (snap.empty) return null;
 
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}  