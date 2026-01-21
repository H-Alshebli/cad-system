// lib/epcr.ts
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =========================
   GET ePCR BY CASE ID
   (1:1 relationship)
========================= */
export const getEpcrByCaseId = async (caseId: string) => {
  if (!caseId) return null;

  const ref = doc(db, "epcr", caseId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
};

/* =========================
   CREATE ePCR FROM CASE
   - One ePCR per Case
   - Draft by default
========================= */
export const createEpcrFromCase = async (
  caseData: any,
  createdBy: string
) => {
  if (!caseData?.id) {
    throw new Error("caseData.id is missing");
  }

  const ref = doc(db, "epcr", caseData.id);
  const snap = await getDoc(ref);

  // 🛑 Do NOT create twice
  if (snap.exists()) {
    return snap.id;
  }

  await setDoc(ref, {
    /* =====================
       RELATIONSHIP
    ===================== */
    epcrId: caseData.id,              // same as doc id
    caseId: caseData.id,
    projectId: caseData.projectId,    // ✅ REQUIRED for Project ePCR list

    /* =====================
       PATIENT INFO (SNAPSHOT)
    ===================== */
    patientInfo: {
      firstName:
        caseData.patient?.name?.split(" ")[0] ||
        caseData.patientName?.split(" ")[0] ||
        "",

      lastName:
        caseData.patient?.name
          ?.split(" ")
          .slice(1)
          .join(" ") ||
        caseData.patientName
          ?.split(" ")
          .slice(1)
          .join(" ") ||
        "",

      age: caseData.patient?.age ?? null,
      gender: caseData.patient?.gender ?? "unknown",
      phone:
        caseData.patient?.phone ??
        caseData.contactNumber ??
        "",

      factoryName: "",
      nationality: "",

      /* ✅ TRIAGE SNAPSHOT */
      triageColor:
        caseData.caseInfo?.level ??
        caseData.level ??
        "",

      healthClassification: "",

      chiefComplaints: caseData.caseInfo?.complaint
        ? [caseData.caseInfo.complaint]
        : caseData.chiefComplaint
        ? [caseData.chiefComplaint]
        : [],

      signsAndSymptoms: [],
    },

    /* =====================
       NARRATIVE (RESTORED ✅)
    ===================== */
    narrative: {
      narrative: "",
      contactedMedicalDirector: false,
      contactedTime: null,
      doctorName: "",
    },

    /* =====================
       STATUS / CONTROL
    ===================== */
    status: "draft",        // draft | finalized
    locked: false,          // lock on finalize
    finalizedAt: null,

    /* =====================
       META
    ===================== */
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return caseData.id;
};
