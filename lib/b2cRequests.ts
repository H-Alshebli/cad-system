import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type B2CRequestStatus =
  | "PendingPayment"
  | "Paid"
  | "Confirmed"
  | "ReadyToActivate"
  | "CadCreated"
  | "Rejected"
  | "Cancelled";

export function getAutoCadActivationAt(requestedTransportAt?: string) {
  if (!requestedTransportAt) return null;

  const tripTime = new Date(requestedTransportAt).getTime();
  if (Number.isNaN(tripTime)) return null;

  return new Date(tripTime - 60 * 60 * 1000).toISOString();
}

export async function createB2CRequest(form: any) {
  const paymentStatus = form.paymentStatus || "Pending";
  const operationalDecision =
    form.operationalDecision || "Approved - Proceed to Pricing";

  let requestStatus: B2CRequestStatus = "PendingPayment";

  if (operationalDecision.startsWith("Rejected")) {
    requestStatus = "Rejected";
  } else if (paymentStatus === "Paid") {
    requestStatus = "Confirmed";
  }

  const ref = await addDoc(collection(db, "b2cRequests"), {
    ...form,

    sourceType: "B2C_REQUEST",

    requestStatus,
    paymentStatus,

    cadCaseId: null,
    cadCreatedAt: null,
    cadCreatedBy: null,

    autoCadActivationAt: getAutoCadActivationAt(form.requestedTransportAt),

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function getB2CRequestById(requestId: string) {
  const snap = await getDoc(doc(db, "b2cRequests", requestId));

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
}

export async function updateB2CRequest(requestId: string, data: any) {
  await updateDoc(doc(db, "b2cRequests", requestId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export function canCreateCadCase(request: any) {
  if (!request) return false;

  const alreadyCreated = !!request.cadCaseId;
  const isPaid = request.paymentStatus === "Paid";
  const isApproved =
    request.operationalDecision === "Approved - Proceed to Pricing" ||
    request.operationalDecision?.startsWith("Approved");

  const isRejectedOrCancelled =
    request.requestStatus === "Rejected" || request.requestStatus === "Cancelled";

  return !alreadyCreated && isPaid && isApproved && !isRejectedOrCancelled;
}

export function isWithinOneHour(request: any) {
  if (!request?.requestedTransportAt) return false;

  const now = Date.now();
  const tripTime = new Date(request.requestedTransportAt).getTime();

  if (Number.isNaN(tripTime)) return false;

  return tripTime - now <= 60 * 60 * 1000;
}

export async function createCadCaseFromB2CRequest(
  requestId: string,
  createdBy = "dispatch"
) {
  const request = await getB2CRequestById(requestId);

  if (!request) {
    throw new Error("B2C request not found.");
  }

  if (!canCreateCadCase(request)) {
    throw new Error("This request is not ready to create CAD case.");
  }

  const timestamp = new Date().toISOString();

  const plannedAssignment = request.plannedAssignment || {};

  const caseRef = await addDoc(collection(db, "cases"), {
    sourceType: "B2C",
    sourceRequestId: requestId,

    status: "Assigned",
    dispatchStatus: "Assigned",

    customerName: request.customerName || "",
    customerMobile: request.customerMobile || "",

    patientName: request.patientName || "",
    patientAge: request.patientAge || "",
    patientGender: request.patientGender || "",
    patientIdOrIqama: request.patientIdOrIqama || "",

    chiefComplaint:
      request.diagnosisOrReason ||
      request.chiefComplaint ||
      request.serviceType ||
      "",

    serviceType: request.serviceType || "Ambulance Transportation",

    pickupText: request.pickupText || "",
    pickupMapLink: request.pickupMapLink || "",
    pickupLat: request.pickupLat || null,
    pickupLng: request.pickupLng || null,
    pickupFloor: request.pickupFloor || "",

    destinationText: request.destinationText || "",
    destinationMapLink: request.destinationMapLink || "",
    destinationLat: request.destinationLat || null,
    destinationLng: request.destinationLng || null,
    destinationFloor: request.destinationFloor || "",

    requestedTransportAt: request.requestedTransportAt || "",

    paymentStatus: request.paymentStatus || "Paid",
    price: request.price || "",
    payer: request.payer || "",

    assignedUnit: plannedAssignment.unitId
      ? {
          type: plannedAssignment.unitType || "ambulance",
          id: plannedAssignment.unitId,
          code: plannedAssignment.unitCode || "",
        }
      : null,

    assignedTeamGroup: plannedAssignment.assignedTeamGroup || "",
    assignedUserIds: plannedAssignment.assignedUserIds || [],

    acknowledgement: {
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
    },

    timeline: {
      Received: timestamp,
      Assigned: timestamp,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "b2cRequests", requestId), {
    requestStatus: "CadCreated",
    cadCaseId: caseRef.id,
    cadCreatedAt: serverTimestamp(),
    cadCreatedBy: createdBy,
    updatedAt: serverTimestamp(),
  });

  return caseRef.id;
}