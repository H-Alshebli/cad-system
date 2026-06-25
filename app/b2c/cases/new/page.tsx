"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  Activity,
  Ambulance,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Lock,
  UserRound,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import {
  createB2CRequest,
  createCancelledB2CRequestFromIntake,
  updateB2CRequest,
} from "@/lib/b2cRequests";
import { uploadB2CMedicalReports } from "@/lib/storageUploads";
import { useCurrentUser } from "@/lib/useCurrentUser";

const serviceScopes = [
  "Inside Riyadh",
  "From Riyadh to another city",
  "From another city to Riyadh",
];

const requestTypes = ["Immediate", "Scheduled"];

const genderOptions = ["Male", "Female"];

const tripTypes = ["One Way", "Round Trip"];

const locationTypes = ["Home", "Hospital", "Other"];

const floorOptions = [
  "Ground Floor",
  "Upper Floor - Elevator Available",
  "Upper Floor - No Elevator",
];

const patientStabilityOptions = [
  "Conscious and Stable",
  "Needs Monitoring",
  "Critical - Refer to 997",
];

const transportLevels = ["BLS - Stable", "ALS - Advanced Medical Support"];

const mobilityOptions = ["Walking", "Wheelchair", "Bedridden"];

const specialRequirements = [
  "Oxygen",
  "Stretcher",
  "Specialized Medical Escort",
  "None",
];

const operationalDecisions = [
  "Approved - Proceed to Pricing",
  "Escalate to Medical Director",
  "Rejected - Document Reason",
];

const payerOptions = ["Customer", "Company", "Insurance"];

const cancellationReasons = [
  { label: "Customer changed mind", value: "Customer changed mind" },
  { label: "Customer booked by mistake", value: "Customer booked by mistake" },
  {
    label: "Customer requested rescheduling",
    value: "Customer requested rescheduling",
  },
  { label: "Duplicate booking", value: "Duplicate booking" },
  { label: "Customer unavailable", value: "Customer unavailable" },
  { label: "Operational issue", value: "Operational issue" },
  { label: "Referred to 997", value: "Referred to 997" },
  { label: "Other", value: "Other" },
];

function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function minus24Hours(datetimeLocal: string) {
  if (!datetimeLocal) return "";

  const date = new Date(datetimeLocal);

  if (Number.isNaN(date.getTime())) return "";

  date.setHours(date.getHours() - 24);

  return toDatetimeLocalValue(date);
}

function getUserName(user: any) {
  return (
    user?.name ||
    user?.displayName ||
    user?.fullName ||
    user?.email ||
    ""
  );
}

function getDefaultPrice(tripType: string) {
  return tripType === "Round Trip" ? "1150" : "690";
}

export default function NewB2CCasePage() {
  const router = useRouter();
  const { user } = useCurrentUser();

  const [saving, setSaving] = useState(false);
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
  const [priceManuallyChanged, setPriceManuallyChanged] = useState(false);
  const [medicalReportFiles, setMedicalReportFiles] = useState<File[]>([]);
  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationNotes, setCancellationNotes] = useState("");
  const [cancellingIntake, setCancellingIntake] = useState(false);

  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [form, setForm] = useState({
    callDateTime: toDatetimeLocalValue(new Date()),
    coordinatorName: "",

    serviceScope: "Inside Riyadh",
    isEmergency: "No - Continue Request",
    requestType: "Immediate",
    requestedTransportAt: "",

    customerName: "",
    customerMobile: "",
    patientName: "",
    patientAge: "",
    patientGender: "Male",
    patientIdOrIqama: "",
    approximateWeight: "",
    tripType: "One Way",

    pickupType: "Home",
    pickupOtherText: "",
    pickupText: "Home",
    pickupMapLink: "",
    pickupFloor: "Ground Floor",

    destinationType: "Hospital",
    destinationHospitalName: "",
    destinationOtherText: "",
    destinationText: "Hospital",
    destinationMapLink: "",
    destinationFloor: "Ground Floor",

    patientStability: "Conscious and Stable",
    transportLevel: "BLS - Stable",
    mobility: "Walking",
    specialRequirements: [] as string[],
    diagnosisOrReason: "",
    hasMedicalReport: "No",

    operationalDecision: "Approved - Proceed to Pricing",
    rejectionReason: "",
    operationalNotes: "",

    price: "690",
    customerApprovedPrice: "No",
    hasWaitingHours: "No",
    waitingHours: "",
    payer: "Customer",
    paymentLink: "",
    paymentLinkSentAt: "",
    paymentLinkSentViaWhatsApp: false,
    paymentStatus: "Pending",

    bookingConfirmationNumber: "",
    customerContactBeforeTrip: "",
    contactPersonName: "",
    contactPersonMobile: "",
    relationToPatient: "Patient",
    notes: "",

    ambulanceBagNumber: "",
    medicationsBag: "",
    devices: "",

    serviceType: "Ambulance Transportation",
    chiefComplaint: "",
    requestedAt: "",
  });

  const [assignment, setAssignment] = useState({
    unitType: "ambulance",
    unitId: "",
    assignedTeamGroup: "",
    assignedUserIds: [] as string[],
  });

  useEffect(() => {
    const unsubAmb = onSnapshot(collection(db, "ambulances"), (snap) => {
      setAmbulances(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a: any) => a.archived !== true)
      );
    });

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(
        snap.docs
          .map((d) => ({ id: d.id, uid: d.id, ...d.data() }))
          .filter((u: any) => u.active !== false)
      );
    });

    return () => {
      unsubAmb();
      unsubUsers();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    setForm((prev) => ({
      ...prev,
      coordinatorName: prev.coordinatorName || getUserName(user),
    }));
  }, [user]);

  const selectedAmbulance = ambulances.find((a) => a.id === assignment.unitId);

  const isRejected = form.operationalDecision.startsWith("Rejected");
  const isEmergencyRefer997 = form.isEmergency === "Yes - Refer to 997";

  function getAmbulanceTeamIds(ambulance: any): string[] {
    if (!ambulance) return [];

    if (Array.isArray(ambulance.assignedUserIds)) {
      return ambulance.assignedUserIds.filter(Boolean);
    }

    if (Array.isArray(ambulance.crewUserIds)) {
      return ambulance.crewUserIds.filter(Boolean);
    }

    if (Array.isArray(ambulance.teamUserIds)) {
      return ambulance.teamUserIds.filter(Boolean);
    }

    if (Array.isArray(ambulance.crewMembers)) {
      return ambulance.crewMembers
        .map((member: any) =>
          typeof member === "string"
            ? member
            : member.userId || member.uid || member.id
        )
        .filter(Boolean);
    }

    if (Array.isArray(ambulance.teamMembers)) {
      return ambulance.teamMembers
        .map((member: any) =>
          typeof member === "string"
            ? member
            : member.userId || member.uid || member.id
        )
        .filter(Boolean);
    }

    return [];
  }

  function getAmbulanceTeamGroup(ambulance: any): string {
    if (!ambulance) return "";

    return (
      ambulance.assignedTeamGroup ||
      ambulance.teamGroup ||
      ambulance.teamName ||
      ambulance.groupName ||
      `${ambulance.code || ambulance.name || "Ambulance"} Team`
    );
  }

  function getUserDisplayName(userId: string) {
    const user = users.find((u) => u.uid === userId || u.id === userId);

    if (user) {
      return (
        user.name ||
        user.displayName ||
        user.fullName ||
        user.email ||
        userId
      );
    }

    const crewMember = selectedAmbulance?.crewMembers?.find(
      (member: any) =>
        member.userId === userId || member.uid === userId || member.id === userId
    );

    return crewMember?.name || crewMember?.email || userId;
  }

  function handleAmbulanceChange(unitId: string) {
    const ambulance = ambulances.find((a) => a.id === unitId);

    const assignedUserIds = getAmbulanceTeamIds(ambulance);
    const assignedTeamGroup = getAmbulanceTeamGroup(ambulance);

    setAssignment({
      unitType: "ambulance",
      unitId,
      assignedTeamGroup,
      assignedUserIds,
    });
  }

  function updateField(name: string, value: string) {
    setForm((prev) => {
      const next: any = { ...prev, [name]: value };

      if (name === "customerName") {
        const shouldAutoFillPatient =
          !prev.patientName || prev.patientName === prev.customerName;

        const shouldAutoFillContact =
          !prev.contactPersonName ||
          prev.contactPersonName === prev.customerName;

        if (shouldAutoFillPatient) {
          next.patientName = value;
        }

        if (shouldAutoFillContact) {
          next.contactPersonName = value;
        }
      }

      if (name === "customerMobile") {
        const shouldAutoFillContactMobile =
          !prev.contactPersonMobile ||
          prev.contactPersonMobile === prev.customerMobile;

        if (shouldAutoFillContactMobile) {
          next.contactPersonMobile = value;
        }
      }

      if (name === "tripType") {
        if (!priceManuallyChanged) {
          next.price = getDefaultPrice(value);
        }
      }

      if (name === "price") {
        setPriceManuallyChanged(true);
      }

      if (name === "requestedTransportAt") {
        next.requestedAt = value;
        next.customerContactBeforeTrip = minus24Hours(value);
      }

      if (name === "diagnosisOrReason") {
        next.chiefComplaint = value;
      }

      if (name === "pickupType") {
        next.pickupText = value === "Other" ? prev.pickupOtherText : value;
      }

      if (name === "pickupOtherText") {
        if (prev.pickupType === "Other") {
          next.pickupText = value;
        }
      }

      if (name === "destinationType") {
        if (value === "Other") {
          next.destinationText = prev.destinationOtherText;
        } else if (value === "Hospital") {
          next.destinationText = prev.destinationHospitalName || "Hospital";
        } else {
          next.destinationText = value;
          next.destinationHospitalName = "";
        }
      }

      if (name === "destinationHospitalName") {
        if (prev.destinationType === "Hospital") {
          next.destinationText = value || "Hospital";
        }
      }

      if (name === "destinationOtherText") {
        if (prev.destinationType === "Other") {
          next.destinationText = value;
        }
      }

      return next;
    });
  }

  function toggleRequirement(value: string) {
    setForm((prev) => {
      const exists = prev.specialRequirements.includes(value);

      if (value === "None") {
        return { ...prev, specialRequirements: exists ? [] : ["None"] };
      }

      const withoutNone = prev.specialRequirements.filter(
        (item) => item !== "None"
      );

      return {
        ...prev,
        specialRequirements: exists
          ? withoutNone.filter((item) => item !== value)
          : [...withoutNone, value],
      };
    });
  }

  async function handleSendPaymentLink() {
    if (!form.customerMobile) {
      alert("Please enter customer mobile first.");
      return;
    }

    if (!form.customerName) {
      alert("Please enter customer name first.");
      return;
    }

    if (!form.patientName) {
      alert("Please enter patient name first.");
      return;
    }

    if (!form.price) {
      alert("Please enter service cost first.");
      return;
    }

    if (!form.paymentLink) {
      alert("Please paste the payment link first.");
      return;
    }

    setSendingPaymentLink(true);

    try {
      const response = await fetch("/api/wati/send-payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerMobile: form.customerMobile,
          customerName: form.customerName,
          patientName: form.patientName,
          amount: form.price,
          paymentLink: form.paymentLink,
        }),
      });

      const data = await response.json();

   if (!response.ok || !data.success) {
  console.error("WATI frontend error:", data);

  throw new Error(
    data?.message ||
      data?.data?.message ||
      data?.data?.error ||
      JSON.stringify(data?.data || data) ||
      "Failed to send payment link."
  );
}

      setForm((prev) => ({
        ...prev,
        paymentLinkSentAt: toDatetimeLocalValue(new Date()),
        paymentLinkSentViaWhatsApp: true,
        customerApprovedPrice: "Yes - Send Payment Link",
      }));

      alert("Payment link sent to customer via WhatsApp.");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to send payment link.");
    } finally {
      setSendingPaymentLink(false);
    }
  }

async function submitB2C() {
  if (
    !form.customerName ||
    !form.customerMobile ||
    !form.patientName ||
    !form.pickupText ||
    !form.destinationText
  ) {
    alert(
      "Please complete customer name, mobile number, patient name, pickup, and destination."
    );
    return;
  }

  if (form.destinationType === "Hospital" && !form.destinationHospitalName.trim()) {
    alert("Please enter the hospital name.");
    return;
  }

  if (!form.requestedTransportAt) {
    alert("Please select the transport date and time.");
    return;
  }

  if (!assignment.unitId) {
    alert("Please select the planned ambulance/unit.");
    return;
  }

  if (assignment.assignedUserIds.length === 0) {
    alert(
      "The selected ambulance has no team linked to it. Please update the ambulance profile or select another ambulance."
    );
    return;
  }

  if (isEmergencyRefer997) {
    alert(
      "This request is marked as emergency. The instruction is to refer the caller to 997 and close the request."
    );
    return;
  }

  if (isRejected && !form.rejectionReason) {
    alert("Please enter the rejection reason.");
    return;
  }

  if (form.hasMedicalReport === "Yes" && medicalReportFiles.length === 0) {
    alert("Please upload the medical report attachment or change Medical Report Available to No.");
    return;
  }

  setSaving(true);

  try {
    const requestId = await createB2CRequest({
      ...form,

      sourceType: "B2C_REQUEST",
      callDateTime: form.callDateTime || toDatetimeLocalValue(new Date()),
      coordinatorName: form.coordinatorName || getUserName(user),

      medicalReportFileNames: medicalReportFiles.map((file) => file.name),
      medicalReportFiles: [],

      plannedAssignment: {
        ...assignment,
        unitCode:
          selectedAmbulance?.code ||
          selectedAmbulance?.name ||
          assignment.unitId ||
          "",
        unitName: selectedAmbulance?.name || "",
        unitTypeName:
          selectedAmbulance?.type ||
          selectedAmbulance?.vehicleType ||
          "Ambulance",
      },
    });

    if (medicalReportFiles.length > 0) {
      const uploadedReports = await uploadB2CMedicalReports(
        requestId,
        medicalReportFiles
      );

      await updateB2CRequest(requestId, {
        medicalReportFiles: uploadedReports,
        medicalReportFileNames: uploadedReports.map((file) => file.name),
      });
    }

    router.push(`/b2c/requests/${requestId}`);
  } catch (error: any) {
    console.error(error);
    alert(error?.message || "Failed to create B2C request");
  } finally {
    setSaving(false);
  }
}

  async function handleCancelIntake() {
    if (!cancellationReason) {
      alert("Please select a cancellation reason.");
      return;
    }

    if (cancellationReason === "Other" && !cancellationNotes.trim()) {
      alert("Please add a note when selecting Other.");
      return;
    }

    setCancellingIntake(true);

    try {
      const requestId = await createCancelledB2CRequestFromIntake(
        {
          ...form,
          sourceType: "B2C_REQUEST",
          callDateTime: form.callDateTime || toDatetimeLocalValue(new Date()),
          coordinatorName: form.coordinatorName || getUserName(user),

          medicalReportFileNames: medicalReportFiles.map((file) => file.name),
          medicalReportFiles: [],

          plannedAssignment: {
            ...assignment,
            unitCode:
              selectedAmbulance?.code ||
              selectedAmbulance?.name ||
              assignment.unitId ||
              "",
            unitName: selectedAmbulance?.name || "",
            unitTypeName:
              selectedAmbulance?.type ||
              selectedAmbulance?.vehicleType ||
              "Ambulance",
          },
        },
        {
          reason: cancellationReason,
          notes: cancellationNotes,
          cancelledBy: user?.uid || user?.id || null,
          cancelledByName: getUserName(user) || null,
          cancelledByRole: user?.role || null,
          cancellationStage: "Intake",
        }
      );

      router.push(`/b2c/requests/${requestId}`);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to save cancelled intake.");
    } finally {
      setCancellingIntake(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-950/20">
            <ClipboardList size={24} />
          </div>

          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              B2C Request Intake
            </div>

            <h1 className="page-title">New B2C Request</h1>

            <p className="page-subtitle">
              Create an individual customer request based on the call intake
              form. The CAD case will be created manually from the request page
              or automatically before the trip time.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={() => setShowCancellationDialog(true)}
        >
          <X size={16} />
          Cancel Intake
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <section className="card-modern space-y-5">
            <SectionTitle
              icon={<ClipboardCheck size={20} />}
              title="1. Call Intake & Eligibility"
              subtitle="Initial call details, service scope, emergency check, and request type."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Call Date & Time">
                <input
                  className="input opacity-80"
                  type="datetime-local"
                  value={form.callDateTime}
                  readOnly
                />
              </Field>

              <Field label="Coordinator Name">
                <input
                  className="input opacity-80"
                  value={form.coordinatorName}
                  readOnly
                />
              </Field>

              <Field label="Service Scope">
                <select
                  className="select"
                  value={form.serviceScope}
                  onChange={(e) => updateField("serviceScope", e.target.value)}
                >
                  {serviceScopes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>

              <Field label="Is the case emergency?">
                <select
                  className="select"
                  value={form.isEmergency}
                  onChange={(e) => updateField("isEmergency", e.target.value)}
                >
                  <option>No - Continue Request</option>
                  <option>Yes - Refer to 997</option>
                </select>
              </Field>

              <Field label="Request Type">
                <select
                  className="select"
                  value={form.requestType}
                  onChange={(e) => updateField("requestType", e.target.value)}
                >
                  {requestTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
            </div>

            {isEmergencyRefer997 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-700 dark:text-red-200">
                This request should be referred to 997 and closed.
              </div>
            )}
          </section>

          <section className="card-modern space-y-5">
            <SectionTitle
              icon={<UserRound size={20} />}
              title="2. Patient Assessment & Trip Details"
              subtitle="Patient details, trip type, pickup point, destination, and floor/elevator information."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Field label="Customer Name *">
                <input
                  className="input"
                  value={form.customerName}
                  onChange={(e) => updateField("customerName", e.target.value)}
                />
              </Field>

              <Field label="Customer Mobile *">
                <input
                  className="input"
                  value={form.customerMobile}
                  onChange={(e) =>
                    updateField("customerMobile", e.target.value)
                  }
                />
              </Field>

              <Field label="Patient Name *">
                <input
                  className="input"
                  value={form.patientName}
                  onChange={(e) => updateField("patientName", e.target.value)}
                />
              </Field>

              <Field label="Age">
                <input
                  className="input"
                  type="number"
                  value={form.patientAge}
                  onChange={(e) => updateField("patientAge", e.target.value)}
                />
              </Field>

              <Field label="Gender">
                <select
                  className="select"
                  value={form.patientGender}
                  onChange={(e) =>
                    updateField("patientGender", e.target.value)
                  }
                >
                  {genderOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>

              <Field label="ID / Iqama Number">
                <input
                  className="input"
                  placeholder="Optional during call"
                  value={form.patientIdOrIqama}
                  onChange={(e) =>
                    updateField("patientIdOrIqama", e.target.value)
                  }
                />
              </Field>

              <Field label="Approximate Weight">
                <input
                  className="input"
                  placeholder="Important for equipment"
                  value={form.approximateWeight}
                  onChange={(e) =>
                    updateField("approximateWeight", e.target.value)
                  }
                />
              </Field>

              <Field label="Trip Type">
                <select
                  className="select"
                  value={form.tripType}
                  onChange={(e) => updateField("tripType", e.target.value)}
                >
                  {tripTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>

              <Field label="Transport Date & Time *">
                <input
                  className="input"
                  type="datetime-local"
                  value={form.requestedTransportAt}
                  onChange={(e) =>
                    updateField("requestedTransportAt", e.target.value)
                  }
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="card-soft space-y-4">
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Pickup Point
                </h3>

                <Field label="Pickup Type *">
                  <select
                    className="select"
                    value={form.pickupType}
                    onChange={(e) => updateField("pickupType", e.target.value)}
                  >
                    {locationTypes.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>

                {form.pickupType === "Other" && (
                  <Field label="Other Pickup Location *">
                    <input
                      className="input"
                      value={form.pickupOtherText}
                      onChange={(e) =>
                        updateField("pickupOtherText", e.target.value)
                      }
                    />
                  </Field>
                )}

                <Field label="Pickup Location Link">
                  <input
                    className="input"
                    value={form.pickupMapLink}
                    onChange={(e) =>
                      updateField("pickupMapLink", e.target.value)
                    }
                  />
                </Field>

                <Field label="Pickup Floor / Elevator">
                  <select
                    className="select"
                    value={form.pickupFloor}
                    onChange={(e) =>
                      updateField("pickupFloor", e.target.value)
                    }
                  >
                    {floorOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="card-soft space-y-4">
                <h3 className="text-base font-black text-slate-950 dark:text-white">
                  Destination
                </h3>

                <Field label="Destination Type *">
                  <select
                    className="select"
                    value={form.destinationType}
                    onChange={(e) =>
                      updateField("destinationType", e.target.value)
                    }
                  >
                    {locationTypes.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>

                {form.destinationType === "Hospital" && (
                  <Field label="Hospital Name *">
                    <input
                      className="input"
                      value={form.destinationHospitalName}
                      onChange={(e) =>
                        updateField("destinationHospitalName", e.target.value)
                      }
                      placeholder="Enter hospital name"
                    />
                  </Field>
                )}
                

                {form.destinationType === "Other" && (
                  <Field label="Other Destination Location *">
                    <input
                      className="input"
                      value={form.destinationOtherText}
                      onChange={(e) =>
                        updateField("destinationOtherText", e.target.value)
                      }
                    />
                  </Field>
                )}

                <Field label="Destination Location Link">
                  <input
                    className="input"
                    value={form.destinationMapLink}
                    onChange={(e) =>
                      updateField("destinationMapLink", e.target.value)
                    }
                  />
                </Field>

                <Field label="Destination Floor / Elevator">
                  <select
                    className="select"
                    value={form.destinationFloor}
                    onChange={(e) =>
                      updateField("destinationFloor", e.target.value)
                    }
                  >
                    {floorOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </section>

          <section className="card-modern space-y-5">
            <SectionTitle
              icon={<Activity size={20} />}
              title="3. Clinical Screening"
              subtitle="Patient stability, transport level, mobility, special requirements, and medical report."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Patient Stability">
                <select
                  className="select"
                  value={form.patientStability}
                  onChange={(e) =>
                    updateField("patientStability", e.target.value)
                  }
                >
                  {patientStabilityOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>

              <Field label="Transport Level">
                <select
                  className="select"
                  value={form.transportLevel}
                  onChange={(e) =>
                    updateField("transportLevel", e.target.value)
                  }
                >
                  {transportLevels.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>

              <Field label="Mobility">
                <select
                  className="select"
                  value={form.mobility}
                  onChange={(e) => updateField("mobility", e.target.value)}
                >
                  {mobilityOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>

              <Field label="Medical Report Available?">
                <select
                  className="select"
                  value={form.hasMedicalReport}
                  onChange={(e) =>
                    updateField("hasMedicalReport", e.target.value)
                  }
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </Field>

              {form.hasMedicalReport === "Yes" && (
                <Field label="Upload Medical Report Attachments">
                  <input
                    className="input"
                    type="file"
                    multiple
                    onChange={(e) =>
                      setMedicalReportFiles(Array.from(e.target.files || []))
                    }
                  />

                  {medicalReportFiles.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-slate-400">
                      {medicalReportFiles.map((file) => (
                        <div key={file.name}>{file.name}</div>
                      ))}
                    </div>
                  )}
                </Field>
              )}
            </div>

            <div>
              <label className="field-label">Special Requirements</label>

              <div className="flex flex-wrap gap-2">
                {specialRequirements.map((item) => {
                  const active = form.specialRequirements.includes(item);

                  return (
                    <button
                      type="button"
                      key={item}
                      onClick={() => toggleRequirement(item)}
                      className={
                        active
                          ? "rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white"
                          : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                      }
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Diagnosis / Reason for Transport">
              <textarea
                className="textarea"
                value={form.diagnosisOrReason}
                onChange={(e) =>
                  updateField("diagnosisOrReason", e.target.value)
                }
              />
            </Field>
          </section>

          <section className="card-modern space-y-5">
            <SectionTitle
              icon={<ClipboardCheck size={20} />}
              title="4. Operational Screening & Destination Confirmation"
              subtitle="Operational approval, escalation, rejection reason, and operational notes."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Operational Decision">
                <select
                  className="select"
                  value={form.operationalDecision}
                  onChange={(e) =>
                    updateField("operationalDecision", e.target.value)
                  }
                >
                  {operationalDecisions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>

              {isRejected && (
                <Field label="Rejection Reason">
                  <input
                    className="input"
                    value={form.rejectionReason}
                    onChange={(e) =>
                      updateField("rejectionReason", e.target.value)
                    }
                  />
                </Field>
              )}
            </div>

            <Field label="Operational Notes">
              <textarea
                className="textarea"
                value={form.operationalNotes}
                onChange={(e) =>
                  updateField("operationalNotes", e.target.value)
                }
              />
            </Field>
          </section>

          <section className="card-modern space-y-5">
            <SectionTitle
              icon={<CreditCard size={20} />}
              title="5. Pricing & Payment"
              subtitle="Service cost, customer approval, payer, manual payment link, WhatsApp sending, and payment confirmation."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Field label="Service Cost Including VAT">
                <input
                  className="input"
                  type="number"
                  value={form.price}
                  onChange={(e) => updateField("price", e.target.value)}
                />
              </Field>

              <Field label="Payment Link">
                <input
                  className="input"
                  value={form.paymentLink}
                  onChange={(e) => updateField("paymentLink", e.target.value)}
                  placeholder="Paste manual payment link here"
                />
              </Field>

              <Field label="Customer Approved Price?">
                <select
                  className="select"
                  value={form.customerApprovedPrice}
                  onChange={(e) =>
                    updateField("customerApprovedPrice", e.target.value)
                  }
                >
                  <option>No</option>
                  <option>Yes - Send Payment Link</option>
                </select>
              </Field>

              <Field label="Payer">
                <select
                  className="select"
                  value={form.payer}
                  onChange={(e) => updateField("payer", e.target.value)}
                >
                  {payerOptions.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>

              <Field label="Waiting Hours?">
                <select
                  className="select"
                  value={form.hasWaitingHours}
                  onChange={(e) =>
                    updateField("hasWaitingHours", e.target.value)
                  }
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </Field>

              {form.hasWaitingHours === "Yes" && (
                <Field label="Number of Waiting Hours">
                  <input
                    className="input"
                    type="number"
                    value={form.waitingHours}
                    onChange={(e) =>
                      updateField("waitingHours", e.target.value)
                    }
                  />
                </Field>
              )}

              <Field label="Payment Link Sent At">
                <input
                  className="input opacity-80"
                  type="datetime-local"
                  value={form.paymentLinkSentAt}
                  readOnly
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={sendingPaymentLink}
                onClick={handleSendPaymentLink}
              >
                {sendingPaymentLink
                  ? "Sending payment link..."
                  : "Send Payment Link to Customer"}
              </button>

              {form.paymentLinkSentViaWhatsApp && (
                <span className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-700 dark:text-emerald-300">
                  Sent via WhatsApp
                </span>
              )}
            </div>

            <div className="card-soft">
              <label className="mb-3 block text-sm font-black text-slate-950 dark:text-white">
                Has payment been confirmed?
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => updateField("paymentStatus", "Pending")}
                  className={
                    form.paymentStatus === "Pending"
                      ? "btn-primary"
                      : "btn-secondary"
                  }
                >
                  No / Pending Payment
                </button>

                <button
                  type="button"
                  onClick={() => updateField("paymentStatus", "Paid")}
                  className={
                    form.paymentStatus === "Paid"
                      ? "btn-primary"
                      : "btn-secondary"
                  }
                >
                  Yes / Paid
                </button>
              </div>
            </div>
          </section>

          <section className="card-modern space-y-5">
            <SectionTitle
              icon={<CheckCircle2 size={20} />}
              title="6. Booking Confirmation"
              subtitle="Booking confirmation number, customer contact details, relation to patient, and additional notes."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Field label="Booking Confirmation Number">
                <input
                  className="input"
                  placeholder="Auto-generated after payment"
                  value={form.bookingConfirmationNumber}
                  onChange={(e) =>
                    updateField("bookingConfirmationNumber", e.target.value)
                  }
                />
              </Field>

              <Field label="Contact Customer 24h Before Trip">
                <input
                  className="input opacity-80"
                  type="datetime-local"
                  value={form.customerContactBeforeTrip}
                  readOnly
                />
              </Field>

              <Field label="Contact Person Name">
                <input
                  className="input"
                  value={form.contactPersonName}
                  onChange={(e) =>
                    updateField("contactPersonName", e.target.value)
                  }
                />
              </Field>

              <Field label="Contact Person Mobile">
                <input
                  className="input"
                  value={form.contactPersonMobile}
                  onChange={(e) =>
                    updateField("contactPersonMobile", e.target.value)
                  }
                />
              </Field>

              <Field label="Relation to Patient">
                <input
                  className="input"
                  value={form.relationToPatient}
                  onChange={(e) =>
                    updateField("relationToPatient", e.target.value)
                  }
                />
              </Field>
            </div>

            <Field label="Additional Notes">
              <textarea
                className="textarea"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </Field>

            <button
              type="button"
              className="btn-primary w-full"
              disabled={saving}
              onClick={submitB2C}
            >
              {saving ? "Creating Request..." : "Submit B2C Request"}
            </button>
          </section>
        </div>

  <aside className="space-y-5">
  <div className="sticky top-5 space-y-5">
    <div className="card-modern">
      <SectionTitle
        icon={<Ambulance size={20} />}
        title="Planned Ambulance & Team"
        subtitle="Select the ambulance. The assigned team will be loaded automatically from the ambulance profile."
      />

      <div className="mt-5 space-y-4">
        <Field label="Planned Ambulance / Unit">
          <select
            className="select"
            value={assignment.unitId}
            onChange={(e) => handleAmbulanceChange(e.target.value)}
          >
            <option value="">Select ambulance</option>

            {ambulances.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code || a.name || a.id}
              </option>
            ))}
          </select>
        </Field>

        {selectedAmbulance ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
              Selected Ambulance
            </div>

            <div className="text-lg font-black text-slate-950 dark:text-white">
              {selectedAmbulance.code ||
                selectedAmbulance.name ||
                selectedAmbulance.id}
            </div>

            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {selectedAmbulance.type ||
                selectedAmbulance.vehicleType ||
                "Ambulance"}
            </div>
          </div>
        ) : (
          <Notice
            type="warning"
            title="No ambulance selected"
            message="Select an ambulance to load the assigned team."
          />
        )}

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 text-xs font-black uppercase tracking-wide text-slate-400">
            Team Assigned to Ambulance
          </div>

          {assignment.assignedTeamGroup ? (
            <div className="mb-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-700 dark:text-blue-300">
              {assignment.assignedTeamGroup}
            </div>
          ) : (
            <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-200">
              No team group is linked to this ambulance.
            </div>
          )}

          {assignment.assignedUserIds.length > 0 ? (
            <div className="space-y-2">
              {assignment.assignedUserIds.map((userId) => (
                <div
                  key={userId}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#0b1220]"
                >
                  <div>
                    <div className="text-sm font-black text-slate-950 dark:text-white">
                      {getUserDisplayName(userId)}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {userId}
                    </div>
                  </div>

                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                    Assigned
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-200">
              No paramedics are linked to this ambulance. Please update the
              ambulance profile or select another unit.
            </div>
          )}
        </div>

        <Notice
          type="warning"
          title="This does not create CAD yet"
          message="This request will be visible as an upcoming request for the planned team. When CAD is created, the same ambulance and team will be copied to the CAD case."
        />
      </div>
    </div>

    <div className="card-modern">
      <SectionTitle
        icon={<Lock size={20} />}
        title="Ambulance Equipment"
        subtitle="Temporary fields. Later we can convert them to managed lists."
      />

      <div className="mt-5 space-y-4">
        <Field label="Ambulance Bag Number">
          <input
            className="input"
            value={form.ambulanceBagNumber}
            onChange={(e) =>
              updateField("ambulanceBagNumber", e.target.value)
            }
          />
        </Field>

        <Field label="Medications Bag">
          <input
            className="input"
            value={form.medicationsBag}
            onChange={(e) => updateField("medicationsBag", e.target.value)}
          />
        </Field>

        <Field label="Devices">
          <input
            className="input"
            value={form.devices}
            onChange={(e) => updateField("devices", e.target.value)}
          />
        </Field>
      </div>
    </div>
  </div>
</aside>
      </div>

      {showCancellationDialog && (
        <CancellationModal
          reason={cancellationReason}
          notes={cancellationNotes}
          saving={cancellingIntake}
          onReasonChange={setCancellationReason}
          onNotesChange={setCancellationNotes}
          onClose={() => {
            if (cancellingIntake) return;
            setShowCancellationDialog(false);
          }}
          onConfirm={handleCancelIntake}
        />
      )}
    </div>
  );
}

function CancellationModal({
  reason,
  notes,
  saving,
  onReasonChange,
  onNotesChange,
  onClose,
  onConfirm,
}: {
  reason: string;
  notes: string;
  saving: boolean;
  onReasonChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Cancel Intake</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Save this call as cancelled. The information entered so far will
              be kept for reporting, and no CAD case will be created.
            </p>
          </div>

          <button
            type="button"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            onClick={onClose}
            disabled={saving}
            aria-label="Close cancellation dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Cancellation Reason *">
            <select
              className="select"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              disabled={saving}
            >
              <option value="">Select reason</option>
              {cancellationReasons.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={reason === "Other" ? "Notes *" : "Notes"}>
            <textarea
              className="textarea"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              disabled={saving}
              placeholder="Optional cancellation notes"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Continue Intake
          </button>

          <button
            type="button"
            className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? "Saving Cancellation..." : "Confirm Cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300">
        {icon}
      </div>

      <div>
        <h2 className="text-lg font-black text-slate-950 dark:text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function Notice({
  type,
  title,
  message,
}: {
  type: "warning" | "danger";
  title: string;
  message: string;
}) {
  const classes =
    type === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200"
      : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200";

  return (
    <div className={`mt-5 rounded-2xl border p-4 text-sm ${classes}`}>
      <div className="font-black">{title}</div>
      <div className="mt-1 leading-6">{message}</div>
    </div>
  );
}