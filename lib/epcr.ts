// lib/epcr.ts

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =========================
   HELPERS
========================= */

function cleanUndefinedDeep(value: any): any {
  if (Array.isArray(value)) {
    return value.map(cleanUndefinedDeep);
  }

  if (value && typeof value === "object") {
    const cleaned: Record<string, any> = {};

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        cleaned[key] = cleanUndefinedDeep(val);
      }
    });

    return cleaned;
  }

  return value;
}

function getFullName(caseData: any) {
  return (
    caseData.patient?.name ||
    caseData.patientName ||
    caseData.customer?.name ||
    caseData.customerName ||
    ""
  );
}

function getFirstName(fullName: string) {
  return fullName.trim().split(" ")[0] || "";
}

function getLastName(fullName: string) {
  return fullName.trim().split(" ").slice(1).join(" ") || "";
}

function getSourceType(caseData: any) {
  return caseData.sourceType || (caseData.projectId ? "PROJECT" : "B2C");
}

/* =========================
   GET ePCR BY CASE ID
   1:1 relationship
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
   - Supports Project + B2C cases
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

  // Do NOT create twice
  if (snap.exists()) {
    return snap.id;
  }

  const fullName = getFullName(caseData);
  const sourceType = getSourceType(caseData);

  const payload = cleanUndefinedDeep({
    /* =====================
       RELATIONSHIP
    ===================== */

    epcrId: caseData.id,
    caseId: caseData.id,

    // Project cases have projectId.
    // B2C cases do not, so save null instead of undefined.
    projectId: caseData.projectId || null,
    projectName: caseData.projectName || null,

    // B2C relationship
    sourceType,
    sourceRequestId: caseData.sourceRequestId || null,
    b2cRequestId:
      caseData.b2cRequestId ||
      caseData.sourceRequestId ||
      null,

    /* =====================
       PATIENT INFO SNAPSHOT
    ===================== */

    patientInfo: {
      patientId:
        caseData.patient?.idNumber ||
        caseData.patientIdOrIqama ||
        caseData.patientId ||
        caseData.id ||
        "",

      firstName: getFirstName(fullName),
      lastName: getLastName(fullName),

      age:
        caseData.patient?.age ??
        caseData.patientAge ??
        null,

      gender:
        caseData.patient?.gender ||
        caseData.patientGender ||
        "unknown",

      phone:
        caseData.patient?.phone ||
        caseData.contactNumber ||
        caseData.customerMobile ||
        caseData.customer?.mobile ||
        "",

      factoryName:
        caseData.projectName ||
        caseData.factoryName ||
        "",

      nationality: "",

      triageColor:
        caseData.caseInfo?.level ||
        caseData.level ||
        caseData.triageLevel ||
        "",

      healthClassification: "",

      chiefComplaints:
        caseData.caseInfo?.complaint
          ? [caseData.caseInfo.complaint]
          : caseData.chiefComplaint
          ? [caseData.chiefComplaint]
          : caseData.diagnosisOrReason
          ? [caseData.diagnosisOrReason]
          : caseData.serviceType
          ? [caseData.serviceType]
          : [],

      signsAndSymptoms: [],
    },

    /* =====================
       CASE SNAPSHOT
    ===================== */

    caseSnapshot: {
      sourceType,

      customerName:
        caseData.customerName ||
        caseData.customer?.name ||
        caseData.callerName ||
        "",

      customerMobile:
        caseData.customerMobile ||
        caseData.customer?.mobile ||
        caseData.contactNumber ||
        "",

      serviceType: caseData.serviceType || "",
      chiefComplaint:
        caseData.chiefComplaint ||
        caseData.caseInfo?.complaint ||
        caseData.diagnosisOrReason ||
        "",

      pickupText:
        caseData.pickupText ||
        caseData.pickupLocation?.text ||
        caseData.locationText ||
        caseData.location?.text ||
        "",

      pickupMapLink:
        caseData.pickupMapLink ||
        caseData.pickupLocation?.googleMapLink ||
        caseData.location?.googleMapLink ||
        "",

      pickupLat:
        caseData.pickupLat ??
        caseData.pickupLocation?.lat ??
        caseData.location?.lat ??
        null,

      pickupLng:
        caseData.pickupLng ??
        caseData.pickupLocation?.lng ??
        caseData.location?.lng ??
        null,

      destinationText:
        caseData.destinationText ||
        caseData.destinationLocation?.text ||
        caseData.destination?.text ||
        "",

      destinationMapLink:
        caseData.destinationMapLink ||
        caseData.destinationLocation?.googleMapLink ||
        caseData.destination?.googleMapLink ||
        "",

      destinationLat:
        caseData.destinationLat ??
        caseData.destinationLocation?.lat ??
        caseData.destination?.lat ??
        null,

      destinationLng:
        caseData.destinationLng ??
        caseData.destinationLocation?.lng ??
        caseData.destination?.lng ??
        null,

      assignedUnit:
        caseData.assignedUnit || null,

      assignedAmbulanceId:
        caseData.assignedAmbulanceId ||
        caseData.assignedUnit?.id ||
        null,

      assignedAmbulanceCode:
        caseData.assignedAmbulanceCode ||
        caseData.ambulanceCode ||
        caseData.assignedUnit?.code ||
        caseData.assignedUnit?.unitCode ||
        "",

      assignedUserIds: Array.isArray(caseData.assignedUserIds)
        ? caseData.assignedUserIds
        : [],
    },

    /* =====================
       NARRATIVE
    ===================== */

    narrative: {
      narrative: "",
      contactedMedicalDirector: false,
      contactedTime: null,
      doctorName: "",
    },

    /* =====================
       ASSESSMENT / VITALS PLACEHOLDERS
    ===================== */

    assessment: {
      primaryAssessment: "",
      secondaryAssessment: "",
      impression: "",
    },

    vitals: [],

    treatment: {
      procedures: [],
      medications: [],
      oxygenTherapy: "",
      notes: "",
    },

    transport: {
      destination:
        caseData.destinationText ||
        caseData.destinationLocation?.text ||
        "",
      handoverTo: "",
      handoverTime: null,
      receivingFacility: "",
    },

    /* =====================
       STATUS / CONTROL
    ===================== */

    status: "draft",
    locked: false,
    finalizedAt: null,

    /* =====================
       META
    ===================== */

    createdBy: createdBy || "system",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(ref, payload);

  return caseData.id;
};