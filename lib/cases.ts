import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type CaseSourceType = "PROJECT" | "B2C";

export type DispatchStatus =
  | "PendingPayment"
  | "ReadyForDispatch"
  | "Assigned"
  | "TeamAcknowledged"
  | "EnRoute"
  | "OnScene"
  | "Transporting"
  | "Closed";

export async function createB2CCase(input: any) {
  const paymentStatus = input.paymentStatus === "Paid" ? "Paid" : "Pending";
  const dispatchStatus: DispatchStatus =
    paymentStatus === "Paid" ? "ReadyForDispatch" : "PendingPayment";

  const caseRef = await addDoc(collection(db, "cases"), {
    sourceType: "B2C",
    sourceId: null,
    customerName: input.customerName || "",
    customerMobile: input.customerMobile || "",
    patientName: input.patientName || "",
    serviceType: input.serviceType || "Ambulance Transportation",
    chiefComplaint: input.chiefComplaint || input.serviceType || "B2C Request",
    level: input.triageLevel || "Level 5 (Non-Urgent)",
    pickup: {
      text: input.pickupText || "",
      googleMapLink: input.pickupMapLink || "",
    },
    destination: {
      text: input.destinationText || "",
      googleMapLink: input.destinationMapLink || "",
    },
    location: {
      text: input.pickupText || "",
      googleMapLink: input.pickupMapLink || "",
      source: "b2c_form",
    },
    locationText: input.pickupText || "",
    requestedAt: input.requestedAt || "",
    price: Number(input.price || 0),
    paymentStatus,
    dispatchStatus,
    status: dispatchStatus,
    notes: input.notes || "",
    assignedUnit: null,
    assignedUserIds: [],
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
    timeline: {
      receivedAt: serverTimestamp(),
      paymentConfirmedAt: paymentStatus === "Paid" ? serverTimestamp() : null,
      assignedAt: null,
      acknowledgedAt: null,
      enRouteAt: null,
      onSceneAt: null,
      transportingAt: null,
      hospitalAt: null,
      closedAt: null,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return caseRef.id;
}

export async function assignCaseToTeam(caseId: string, input: any) {
  const assignedUserIds = Array.isArray(input.assignedUserIds)
    ? input.assignedUserIds.filter(Boolean)
    : String(input.assignedUserIds || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

  await updateDoc(doc(db, "cases", caseId), {
    assignedUnit: {
      type: input.unitType || "ambulance",
      id: input.unitId || "",
      code: input.unitCode || input.unitId || "",
    },
    assignedTeamGroup: input.assignedTeamGroup || "",
    assignedUserIds,
    dispatchStatus: "Assigned",
    status: "Assigned",
    "timeline.assignedAt": serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function acknowledgeCase(caseId: string, user: any) {
  await updateDoc(doc(db, "cases", caseId), {
    acknowledged: true,
    acknowledgedBy: user?.uid || null,
    acknowledgedByName: user?.name || user?.email || "Assigned user",
    acknowledgedAt: serverTimestamp(),
    dispatchStatus: "TeamAcknowledged",
    status: "TeamAcknowledged",
    "timeline.acknowledgedAt": serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getCaseById(caseId: string) {
  const snap = await getDoc(doc(db, "cases", caseId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
