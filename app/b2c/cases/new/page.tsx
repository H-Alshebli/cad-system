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
} from "lucide-react";

import { db } from "@/lib/firebase";
import { createB2CRequest } from "@/lib/b2cRequests";

const serviceScopes = [
  "Inside Riyadh",
  "From Riyadh to another city",
  "From another city to Riyadh",
];

const requestTypes = ["Immediate", "Scheduled"];

const genderOptions = ["Male", "Female"];

const tripTypes = ["One Way", "Round Trip"];

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

export default function NewB2CCasePage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [form, setForm] = useState({
    callNumber: "",
    callDateTime: new Date().toISOString(),
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

    pickupText: "",
    pickupMapLink: "",
    pickupFloor: "Ground Floor",

    destinationText: "",
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

    price: "",
    customerApprovedPrice: "No",
    hasWaitingHours: "No",
    waitingHours: "",
    payer: "Customer",
    paymentLinkSentAt: "",
    paymentStatus: "Pending",

    bookingConfirmationNumber: "",
    customerContactBeforeTrip: "",
    contactPersonName: "",
    contactPersonMobile: "",
    relationToPatient: "",
    notes: "",

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
    return user.name || user.displayName || user.fullName || user.email || userId;
  }

  const crewMember = selectedAmbulance?.crewMembers?.find(
    (member: any) => member.userId === userId || member.uid === userId || member.id === userId
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
      const next = { ...prev, [name]: value };

      if (name === "requestedTransportAt") {
        next.requestedAt = value;
      }

      if (name === "diagnosisOrReason") {
        next.chiefComplaint = value;
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

    setSaving(true);

    try {
      const requestId = await createB2CRequest({
        ...form,

        sourceType: "B2C_REQUEST",
        callDateTime: form.callDateTime || new Date().toISOString(),

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

      router.push(`/b2c/requests/${requestId}`);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to create B2C request");
    } finally {
      setSaving(false);
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
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <section className="card-modern space-y-5">
            <SectionTitle
              icon={<ClipboardCheck size={20} />}
              title="1. Call Intake & Eligibility"
              subtitle="Initial call details, service scope, emergency check, and request type."
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Field label="Call Number">
                <input
                  className="input"
                  placeholder="Auto-generated or manual"
                  value={form.callNumber}
                  onChange={(e) => updateField("callNumber", e.target.value)}
                />
              </Field>

              <Field label="Call Date & Time">
                <input
                  className="input"
                  type="datetime-local"
                  value={form.callDateTime.slice(0, 16)}
                  onChange={(e) => updateField("callDateTime", e.target.value)}
                />
              </Field>

              <Field label="Coordinator Name">
                <input
                  className="input"
                  value={form.coordinatorName}
                  onChange={(e) =>
                    updateField("coordinatorName", e.target.value)
                  }
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

                <Field label="Pickup Location Name *">
                  <input
                    className="input"
                    value={form.pickupText}
                    onChange={(e) => updateField("pickupText", e.target.value)}
                  />
                </Field>

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

                <Field label="Destination Location Name *">
                  <input
                    className="input"
                    value={form.destinationText}
                    onChange={(e) =>
                      updateField("destinationText", e.target.value)
                    }
                  />
                </Field>

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
              subtitle="Service cost, customer approval, waiting hours, payer, payment link, and payment confirmation."
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
                  className="input"
                  type="datetime-local"
                  value={form.paymentLinkSentAt}
                  onChange={(e) =>
                    updateField("paymentLinkSentAt", e.target.value)
                  }
                />
              </Field>
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
                  className="input"
                  type="datetime-local"
                  value={form.customerContactBeforeTrip}
                  onChange={(e) =>
                    updateField("customerContactBeforeTrip", e.target.value)
                  }
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
          <div className="card-modern sticky top-5">
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
                    No paramedics are linked to this ambulance. Please update
                    the ambulance profile or select another unit.
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
              title="New B2C Flow"
              subtitle="The request is created first. CAD is activated later."
            />

            <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li>1. Dispatcher creates B2C request.</li>
              <li>2. Dispatcher selects the planned ambulance.</li>
              <li>3. System loads the ambulance team automatically.</li>
              <li>4. Request appears to the assigned team as Upcoming Request.</li>
              <li>5. Dispatcher manually clicks Create CAD Case.</li>
              <li>6. If not done manually, CAD will be created before trip time.</li>
              <li>7. Team opens the active CAD mission.</li>
            </ol>
          </div>
        </aside>
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