import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type DocumentData,
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

export type PaymentStatus = "Pending" | "Paid";

export type ReturnTripStatus =
  | "Not Created"
  | "Ready"
  | "Created"
  | "Cancelled";

export type PlannedAssignment = {
  unitType?: string;
  unitId?: string;
  unitCode?: string;
  unitName?: string;
  unitTypeName?: string;
  assignedTeamGroup?: string;
  assignedUserIds?: string[];
};

export type B2CRequest = {
  id: string;

  sourceType?: string;
  requestStatus?: B2CRequestStatus;
  paymentStatus?: PaymentStatus;

  requestType?: string;
  serviceScope?: string;

  callDateTime?: string;
  coordinatorName?: string;

  customerName?: string;
  customerMobile?: string;

  patientName?: string;
  patientAge?: string;
  patientGender?: string;
  patientIdOrIqama?: string;
  approximateWeight?: string;

  tripType?: string;
  requestedTransportAt?: string;
  requestedAt?: string;

  pickupType?: string;
  pickupOtherText?: string;
  pickupText?: string;
  pickupMapLink?: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupFloor?: string;

  destinationType?: string;
  destinationHospitalName?: string;
  destinationOtherText?: string;
  destinationText?: string;
  destinationMapLink?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationFloor?: string;

  patientStability?: string;
  transportLevel?: string;
  mobility?: string;
  specialRequirements?: string[];
  diagnosisOrReason?: string;
  chiefComplaint?: string;
  serviceType?: string;
  hasMedicalReport?: string;
  medicalReportFileNames?: string[];

  operationalDecision?: string;
  rejectionReason?: string;
  operationalNotes?: string;

  price?: string;
  payer?: string;
  customerApprovedPrice?: string;
  hasWaitingHours?: string;
  waitingHours?: string;
  paymentLink?: string;
  paymentLinkSentAt?: string;
  paymentLinkSentViaWhatsApp?: boolean;
  bookingConfirmationNumber?: string;

  customerContactBeforeTrip?: string;
  contactPersonName?: string;
  contactPersonMobile?: string;
  relationToPatient?: string;
  notes?: string;

  ambulanceBagNumber?: string;
  medicationsBag?: string;
  devices?: string;

  plannedAssignment?: PlannedAssignment;

  cadCaseId?: string | null;
  cadCreatedAt?: any;
  cadCreatedBy?: string | null;

  returnCadCaseId?: string | null;
  returnCadCreatedAt?: any;
  returnCadCreatedBy?: string | null;
  returnTripStatus?: ReturnTripStatus | null;

  autoCadActivationAt?: string | null;

  createdAt?: any;
  updatedAt?: any;

  [key: string]: any;
};

function toDateValue(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  return null;
}

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

export function getAutoCadActivationAt(requestedTransportAt?: string) {
  const tripDate = toDateValue(requestedTransportAt);

  if (!tripDate) return null;

  return new Date(tripDate.getTime() - 60 * 60 * 1000).toISOString();
}

export function isWithinOneHour(request: B2CRequest | null) {
  const tripDate = toDateValue(request?.requestedTransportAt);

  if (!tripDate) return false;

  const now = Date.now();
  const tripTime = tripDate.getTime();

  return tripTime - now <= 60 * 60 * 1000;
}

function getRequestStatus(form: any): B2CRequestStatus {
  const paymentStatus = form.paymentStatus || "Pending";
  const operationalDecision =
    form.operationalDecision || "Approved - Proceed to Pricing";

  if (operationalDecision.startsWith("Rejected")) {
    return "Rejected";
  }

  if (paymentStatus !== "Paid") {
    return "PendingPayment";
  }

  if (form.requestType === "Immediate") {
    return "ReadyToActivate";
  }

  if (form.requestType === "Scheduled") {
    const autoAt = getAutoCadActivationAt(form.requestedTransportAt);
    const now = Date.now();

    if (autoAt && new Date(autoAt).getTime() <= now) {
      return "ReadyToActivate";
    }

    return "Confirmed";
  }

  return "Confirmed";
}

function normalizePlannedAssignment(form: any): PlannedAssignment {
  const plannedAssignment = form.plannedAssignment || {};

  return {
    unitType: plannedAssignment.unitType || "ambulance",
    unitId: plannedAssignment.unitId || "",
    unitCode: plannedAssignment.unitCode || "",
    unitName: plannedAssignment.unitName || "",
    unitTypeName: plannedAssignment.unitTypeName || "Ambulance",
    assignedTeamGroup: plannedAssignment.assignedTeamGroup || "",
    assignedUserIds: Array.isArray(plannedAssignment.assignedUserIds)
      ? plannedAssignment.assignedUserIds
      : [],
  };
}

function getB2CDestinationText(request: B2CRequest) {
  if (request.destinationType === "Hospital") {
    return (
      request.destinationHospitalName ||
      request.destinationText ||
      "Hospital"
    );
  }

  return request.destinationText || "";
}

function getB2CReturnDestinationText(request: B2CRequest) {
  if (request.pickupType === "Hospital") {
    return request.pickupOtherText || request.pickupText || "Hospital";
  }

  return request.pickupText || "";
}

export async function createB2CRequest(form: any) {
  const paymentStatus: PaymentStatus =
    form.paymentStatus === "Paid" ? "Paid" : "Pending";

  const requestStatus = getRequestStatus({
    ...form,
    paymentStatus,
  });

  const plannedAssignment = normalizePlannedAssignment(form);

  const payload = cleanUndefinedDeep({
    ...form,

    sourceType: "B2C_REQUEST",

    requestStatus,
    paymentStatus,

    plannedAssignment,

    cadCaseId: null,
    cadCreatedAt: null,
    cadCreatedBy: null,

    returnCadCaseId: null,
    returnCadCreatedAt: null,
    returnCadCreatedBy: null,
    returnTripStatus:
      form.tripType === "Round Trip" ? "Not Created" : null,

    autoCadActivationAt: getAutoCadActivationAt(form.requestedTransportAt),

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const ref = await addDoc(collection(db, "b2cRequests"), payload);

  return ref.id;
}

export async function getB2CRequestById(
  requestId: string
): Promise<B2CRequest | null> {
  const snap = await getDoc(doc(db, "b2cRequests", requestId));

  if (!snap.exists()) return null;

  const data = snap.data() as DocumentData;

  return {
    id: snap.id,
    ...data,
  } as B2CRequest;
}

export async function updateB2CRequest(requestId: string, data: any) {
  await updateDoc(
    doc(db, "b2cRequests", requestId),
    cleanUndefinedDeep({
      ...data,
      updatedAt: serverTimestamp(),
    })
  );
}

export function canCreateCadCase(request: B2CRequest | null) {
  if (!request) return false;

  const alreadyCreated = !!request.cadCaseId;

  const isPaid = request.paymentStatus === "Paid";

  const isApproved =
    request.operationalDecision === "Approved - Proceed to Pricing" ||
    request.operationalDecision?.startsWith("Approved");

  const isRejectedOrCancelled =
    request.requestStatus === "Rejected" ||
    request.requestStatus === "Cancelled";

  return !alreadyCreated && isPaid && isApproved && !isRejectedOrCancelled;
}

export function canAutoCreateCadCase(request: B2CRequest | null) {
  if (!canCreateCadCase(request)) return false;

  if (request?.requestType === "Immediate") return true;

  return isWithinOneHour(request);
}

export async function createCadCaseFromB2CRequest(
  requestId: string,
  createdBy = "dispatch"
) {
  const request = await getB2CRequestById(requestId);

  if (!request) {
    throw new Error("B2C request not found.");
  }

  if (request.cadCaseId) {
    return request.cadCaseId;
  }

  if (!canCreateCadCase(request)) {
    throw new Error(
      "This request is not ready to create CAD case. Payment must be Paid and operational decision must be Approved."
    );
  }

  const timestamp = new Date().toISOString();
  const plannedAssignment = normalizePlannedAssignment(request);

  const casePayload = cleanUndefinedDeep({
    sourceType: "B2C",
    sourceRequestId: requestId,
    b2cRequestId: requestId,

    caseType: "B2C",
    requestType: request.requestType || "Immediate",
    serviceScope: request.serviceScope || "",

    tripType: request.tripType || "",
    tripLeg: "outbound",
    linkedReturnCaseId: "",

    suppressInitialAlert: true,
    alertOnCreate: false,

    status: "Assigned",
    dispatchStatus: "Assigned",

    callDateTime: request.callDateTime || "",
    coordinatorName: request.coordinatorName || "",

    customerName: request.customerName || "",
    customerMobile: request.customerMobile || "",

    patientName: request.patientName || "",
    patientAge: request.patientAge || "",
    patientGender: request.patientGender || "",
    patientIdOrIqama: request.patientIdOrIqama || "",
    approximateWeight: request.approximateWeight || "",

    chiefComplaint:
      request.diagnosisOrReason ||
      request.chiefComplaint ||
      request.serviceType ||
      "",

    diagnosisOrReason: request.diagnosisOrReason || "",
    serviceType: request.serviceType || "Ambulance Transportation",

    patientStability: request.patientStability || "",
    transportLevel: request.transportLevel || "",
    mobility: request.mobility || "",
    specialRequirements: request.specialRequirements || [],
    hasMedicalReport: request.hasMedicalReport || "No",
    medicalReportFileNames: request.medicalReportFileNames || [],

    pickupType: request.pickupType || "",
    pickupOtherText: request.pickupOtherText || "",
    pickupText: request.pickupText || "",
    pickupMapLink: request.pickupMapLink || "",
    pickupLat: request.pickupLat || null,
    pickupLng: request.pickupLng || null,
    pickupFloor: request.pickupFloor || "",

    destinationType: request.destinationType || "",
    destinationHospitalName: request.destinationHospitalName || "",
    destinationOtherText: request.destinationOtherText || "",
    destinationText: getB2CDestinationText(request),
    destinationMapLink: request.destinationMapLink || "",
    destinationLat: request.destinationLat || null,
    destinationLng: request.destinationLng || null,
    destinationFloor: request.destinationFloor || "",

    destination: {
      text: getB2CDestinationText(request),
      googleMapLink: request.destinationMapLink || "",
      lat: request.destinationLat || null,
      lng: request.destinationLng || null,
      hospitalName: request.destinationHospitalName || "",
      type: request.destinationType || "",
      floor: request.destinationFloor || "",
    },

    requestedTransportAt: request.requestedTransportAt || "",
    requestedAt: request.requestedTransportAt || request.requestedAt || "",

    operationalDecision: request.operationalDecision || "",
    rejectionReason: request.rejectionReason || "",
    operationalNotes: request.operationalNotes || "",

    paymentStatus: request.paymentStatus || "Paid",
    price: request.price || "",
    payer: request.payer || "",
    customerApprovedPrice: request.customerApprovedPrice || "",
    hasWaitingHours: request.hasWaitingHours || "No",
    waitingHours: request.waitingHours || "",
    paymentLink: request.paymentLink || "",
    paymentLinkSentAt: request.paymentLinkSentAt || "",
    paymentLinkSentViaWhatsApp:
      request.paymentLinkSentViaWhatsApp === true || false,
    bookingConfirmationNumber: request.bookingConfirmationNumber || "",

    customerContactBeforeTrip: request.customerContactBeforeTrip || "",
    contactPersonName: request.contactPersonName || "",
    contactPersonMobile: request.contactPersonMobile || "",
    relationToPatient: request.relationToPatient || "",
    notes: request.notes || "",

    ambulanceBagNumber: request.ambulanceBagNumber || "",
    medicationsBag: request.medicationsBag || "",
    devices: request.devices || "",

    assignedUnit: plannedAssignment.unitId
      ? {
          type: plannedAssignment.unitType || "ambulance",
          id: plannedAssignment.unitId,
          code: plannedAssignment.unitCode || "",
          name: plannedAssignment.unitName || "",
          unitTypeName: plannedAssignment.unitTypeName || "Ambulance",
        }
      : null,

    assignedAmbulanceId: plannedAssignment.unitId || "",
    assignedAmbulanceCode: plannedAssignment.unitCode || "",
    assignedTeamGroup: plannedAssignment.assignedTeamGroup || "",
    assignedUserIds: plannedAssignment.assignedUserIds || [],

    acknowledgement: {
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedByName: null,
      acknowledgedAt: null,
    },

    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedByName: null,
    acknowledgedAt: null,

    timeline: {
      Received: timestamp,
      Assigned: timestamp,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const caseRef = await addDoc(collection(db, "cases"), casePayload);

  await updateDoc(doc(db, "b2cRequests", requestId), {
    requestStatus: "CadCreated",
    cadCaseId: caseRef.id,
    cadCreatedAt: serverTimestamp(),
    cadCreatedBy: createdBy,
    returnTripStatus:
      request.tripType === "Round Trip"
        ? request.returnTripStatus || "Not Created"
        : null,
    updatedAt: serverTimestamp(),
  });

  return caseRef.id;
}

export function canCreateReturnCadCase(request: B2CRequest | null) {
  if (!request) return false;

  const isRoundTrip = request.tripType === "Round Trip";
  const hasOutboundCad = !!request.cadCaseId;
  const alreadyHasReturnCad = !!request.returnCadCaseId;

  const isRejectedOrCancelled =
    request.requestStatus === "Rejected" ||
    request.requestStatus === "Cancelled" ||
    request.returnTripStatus === "Cancelled";

  return (
    isRoundTrip &&
    hasOutboundCad &&
    !alreadyHasReturnCad &&
    !isRejectedOrCancelled
  );
}

export async function createReturnCadCaseFromB2CRequest(
  requestId: string,
  createdBy = "dispatch"
) {
  const request = await getB2CRequestById(requestId);

  if (!request) {
    throw new Error("B2C request not found.");
  }

  if (!canCreateReturnCadCase(request)) {
    throw new Error(
      "Return CAD cannot be created. This must be a Round Trip request with an outbound CAD already created."
    );
  }

  const timestamp = new Date().toISOString();
  const plannedAssignment = normalizePlannedAssignment(request);

  const returnPickupText = getB2CDestinationText(request);
  const returnDestinationText = getB2CReturnDestinationText(request);

  const casePayload = cleanUndefinedDeep({
    sourceType: "B2C",
    sourceRequestId: requestId,
    b2cRequestId: requestId,

    caseType: "B2C",
    requestType: request.requestType || "Scheduled",
    serviceScope: request.serviceScope || "",

    tripType: request.tripType || "Round Trip",
    tripLeg: "return",
    linkedOutboundCaseId: request.cadCaseId || "",

    suppressInitialAlert: true,
    alertOnCreate: false,

    status: "Assigned",
    dispatchStatus: "Assigned",

    callDateTime: request.callDateTime || "",
    coordinatorName: request.coordinatorName || "",

    customerName: request.customerName || "",
    customerMobile: request.customerMobile || "",

    patientName: request.patientName || "",
    patientAge: request.patientAge || "",
    patientGender: request.patientGender || "",
    patientIdOrIqama: request.patientIdOrIqama || "",
    approximateWeight: request.approximateWeight || "",

    chiefComplaint:
      request.diagnosisOrReason ||
      request.chiefComplaint ||
      request.serviceType ||
      "",

    diagnosisOrReason: request.diagnosisOrReason || "",
    serviceType: request.serviceType || "Ambulance Transportation",

    patientStability: request.patientStability || "",
    transportLevel: request.transportLevel || "",
    mobility: request.mobility || "",
    specialRequirements: request.specialRequirements || [],
    hasMedicalReport: request.hasMedicalReport || "No",
    medicalReportFileNames: request.medicalReportFileNames || [],

    pickupType: request.destinationType || "",
    pickupOtherText: request.destinationOtherText || "",
    pickupText: returnPickupText,
    pickupMapLink: request.destinationMapLink || "",
    pickupLat: request.destinationLat || null,
    pickupLng: request.destinationLng || null,
    pickupFloor: request.destinationFloor || "",

    destinationType: request.pickupType || "",
    destinationHospitalName:
      request.pickupType === "Hospital"
        ? request.pickupOtherText || request.pickupText || "Hospital"
        : "",
    destinationOtherText: request.pickupOtherText || "",
    destinationText: returnDestinationText,
    destinationMapLink: request.pickupMapLink || "",
    destinationLat: request.pickupLat || null,
    destinationLng: request.pickupLng || null,
    destinationFloor: request.pickupFloor || "",

    destination: {
      text: returnDestinationText,
      googleMapLink: request.pickupMapLink || "",
      lat: request.pickupLat || null,
      lng: request.pickupLng || null,
      hospitalName:
        request.pickupType === "Hospital"
          ? request.pickupOtherText || request.pickupText || "Hospital"
          : "",
      type: request.pickupType || "",
      floor: request.pickupFloor || "",
    },

    requestedTransportAt: request.requestedTransportAt || "",
    requestedAt: request.requestedTransportAt || request.requestedAt || "",

    operationalDecision: request.operationalDecision || "",
    rejectionReason: request.rejectionReason || "",
    operationalNotes: request.operationalNotes || "",

    paymentStatus: request.paymentStatus || "Paid",
    price: request.price || "",
    payer: request.payer || "",
    customerApprovedPrice: request.customerApprovedPrice || "",
    hasWaitingHours: request.hasWaitingHours || "No",
    waitingHours: request.waitingHours || "",
    paymentLink: request.paymentLink || "",
    paymentLinkSentAt: request.paymentLinkSentAt || "",
    paymentLinkSentViaWhatsApp:
      request.paymentLinkSentViaWhatsApp === true || false,
    bookingConfirmationNumber: request.bookingConfirmationNumber || "",

    customerContactBeforeTrip: request.customerContactBeforeTrip || "",
    contactPersonName: request.contactPersonName || "",
    contactPersonMobile: request.contactPersonMobile || "",
    relationToPatient: request.relationToPatient || "",
    notes: request.notes || "",

    ambulanceBagNumber: request.ambulanceBagNumber || "",
    medicationsBag: request.medicationsBag || "",
    devices: request.devices || "",

    assignedUnit: plannedAssignment.unitId
      ? {
          type: plannedAssignment.unitType || "ambulance",
          id: plannedAssignment.unitId,
          code: plannedAssignment.unitCode || "",
          name: plannedAssignment.unitName || "",
          unitTypeName: plannedAssignment.unitTypeName || "Ambulance",
        }
      : null,

    assignedAmbulanceId: plannedAssignment.unitId || "",
    assignedAmbulanceCode: plannedAssignment.unitCode || "",
    assignedTeamGroup: plannedAssignment.assignedTeamGroup || "",
    assignedUserIds: plannedAssignment.assignedUserIds || [],

    acknowledgement: {
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedByName: null,
      acknowledgedAt: null,
    },

    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedByName: null,
    acknowledgedAt: null,

    timeline: {
      Received: timestamp,
      Assigned: timestamp,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const returnCaseRef = await addDoc(collection(db, "cases"), casePayload);

  await updateDoc(doc(db, "b2cRequests", requestId), {
    returnCadCaseId: returnCaseRef.id,
    returnCadCreatedAt: serverTimestamp(),
    returnCadCreatedBy: createdBy,
    returnTripStatus: "Created",
    updatedAt: serverTimestamp(),
  });

  if (request.cadCaseId) {
    await updateDoc(doc(db, "cases", request.cadCaseId), {
      linkedReturnCaseId: returnCaseRef.id,
      updatedAt: serverTimestamp(),
    });
  }

  return returnCaseRef.id;
}