// lib/epcr.ts

import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
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
    // Preserve Firestore special values such as serverTimestamp, Timestamp,
    // GeoPoint, and DocumentReference. Recursing into them turns them into
    // plain objects and prevents Firestore from resolving their real value.
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }

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

export const createManualEpcr = async ({
  projectId,
  projectName,
  unitId,
  unitCode,
  createdBy,
  createdByName,
}: {
  projectId: string;
  projectName: string;
  unitId?: string;
  unitCode?: string;
  createdBy: string;
  createdByName?: string;
}) => {
  if (!projectId || !projectName) {
    throw new Error("Project is required for a manual ePCR.");
  }

  // A manual ePCR is still an operational event. Create its CAD case and
  // clinical record atomically with the same ID so neither can be orphaned.
  const caseRef = doc(collection(db, "cases"));
  const epcrRef = doc(db, "epcr", caseRef.id);
  const assignedUserIds = createdBy ? [createdBy] : [];
  const assignedUnit = unitId
    ? {
        type: "ambulance",
        id: unitId,
        code: unitCode || unitId,
        unitCode: unitCode || unitId,
      }
    : null;

  const casePayload = cleanUndefinedDeep({
    sourceType: "MANUAL_EPCR",
    caseType: "Manual ePCR",
    sourceId: null,
    manualEpcr: true,
    projectId,
    projectName,
    callerName: createdByName || "Responder",
    contactNumber: "",
    patientName: "",
    chiefComplaint: "Manual ePCR",
    level: "",
    patient: {
      name: "",
      phone: "",
      age: null,
      gender: "unknown",
    },
    caseInfo: {
      complaint: "Manual ePCR",
      level: "",
      paramedicNote: "Created by responder from Manual ePCR.",
    },
    location: {
      text: "",
      googleMapLink: "",
      source: "manual_epcr",
    },
    locationText: "",
    paymentStatus: "NotRequired",
    dispatchStatus: "OnScene",
    status: "OnScene",
    assignedUnit,
    assignedUserIds,
    acknowledged: true,
    acknowledgedBy: createdBy || null,
    acknowledgedByName: createdByName || "Responder",
    acknowledgedAt: serverTimestamp(),
    timeline: {
      receivedAt: serverTimestamp(),
      assignedAt: serverTimestamp(),
      acknowledgedAt: serverTimestamp(),
      enRouteAt: serverTimestamp(),
      onSceneAt: serverTimestamp(),
      transportingAt: null,
      hospitalAt: null,
      returningAt: null,
      closedAt: null,
    },
    createdBy: createdBy || "manual",
    createdByName: createdByName || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const epcrPayload = cleanUndefinedDeep({
    epcrId: epcrRef.id,
    caseId: caseRef.id,
    isManual: true,
    sourceType: "MANUAL_EPCR",
    projectId,
    projectName,
    projectInfo: {
      projectId,
      projectName,
      tripLeg: "",
    },
    patientInfo: {
      firstName: "",
      lastName: "",
      age: null,
      gender: "unknown",
      phone: "",
      factoryName: projectName,
      nationality: "",
      triageColor: "",
      healthClassification: "",
      chiefComplaints: [],
      chiefComplaintDetails: {},
      signsAndSymptoms: [],
    },
    caseSnapshot: {
      sourceType: "MANUAL_EPCR",
      assignedUnit,
      assignedAmbulanceId: unitId || null,
      assignedAmbulanceCode: unitCode || "",
      assignedUserIds,
    },
    status: "draft",
    locked: false,
    finalizedAt: null,
    createdBy: createdBy || "manual",
    createdByName: createdByName || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  batch.set(caseRef, casePayload);
  batch.set(epcrRef, epcrPayload);
  await batch.commit();

  return caseRef.id;
};
