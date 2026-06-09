"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  Ambulance,
  ArrowRight,
  CalendarClock,
  CreditCard,
  Edit3,
  MapPin,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { can } from "@/lib/can";
import {
  canCreateCadCase,
  createCadCaseFromB2CRequest,
  isWithinOneHour,
  updateB2CRequest,
} from "@/lib/b2cRequests";

export default function B2CRequestDetailsPage({
  params,
}: {
  params: { requestId: string };
}) {
  const router = useRouter();
  const requestId = params.requestId;

  const { user, loading: userLoading } = useCurrentUser();

  const roleRaw = String(user?.role || "").trim();
  const role = roleRaw.toLowerCase();

  // IMPORTANT:
  // Use roleRaw here because Firestore role document is "Dispatcher",
  // not "dispatcher".
  const { permissions, loading: permissionsLoading } = usePermissions(roleRaw);

  const isAdmin =
    role === "admin" || role === "super_admin" || role === "superadmin";

  const canViewB2CRequest =
    isAdmin ||
    can(permissions, "b2c_requests", "view") ||
    can(permissions, "b2c_requests", "view_all") ||
    can(permissions, "b2c_requests", "view_assigned");

  const canEditB2CRequest =
    isAdmin ||
    can(permissions, "b2c_requests", "edit") ||
    can(permissions, "b2c_requests", "update");

  const canConfirmB2CPayment =
    isAdmin || can(permissions, "b2c_requests", "confirm_payment");

  const canChangeB2CTeam =
    isAdmin || can(permissions, "b2c_requests", "change_team");

  const canActivateB2CCad =
    isAdmin || can(permissions, "b2c_requests", "activate_cad");

  const isDispatch =
    isAdmin ||
    canEditB2CRequest ||
    canConfirmB2CPayment ||
    canChangeB2CTeam ||
    canActivateB2CCad;

  const isParamedic =
    role === "paramedic" ||
    role === "emt" ||
    role === "medical" ||
    role === "crew" ||
    can(permissions, "missions", "view_assigned");

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creatingCad, setCreatingCad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [acknowledgingRequest, setAcknowledgingRequest] = useState(false);

  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [editForm, setEditForm] = useState<any>({
    requestType: "",
    customerName: "",
    customerMobile: "",
    patientName: "",
    patientAge: "",
    patientGender: "",
    patientIdOrIqama: "",
    requestedTransportAt: "",
    pickupText: "",
    pickupMapLink: "",
    pickupFloor: "",
    destinationText: "",
    destinationMapLink: "",
    destinationFloor: "",
    patientStability: "",
    transportLevel: "",
    mobility: "",
    diagnosisOrReason: "",
    operationalDecision: "",
    rejectionReason: "",
    operationalNotes: "",
    price: "",
    payer: "",
    paymentStatus: "Pending",
    customerApprovedPrice: "",
    paymentLinkSentAt: "",
    bookingConfirmationNumber: "",
  });

  const [assignment, setAssignment] = useState({
    unitType: "ambulance",
    unitId: "",
    unitCode: "",
    unitName: "",
    unitTypeName: "",
    assignedTeamGroup: "",
    assignedUserIds: [] as string[],
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "b2cRequests", requestId), (snap) => {
      if (!snap.exists()) {
        setRequest(null);
        setLoading(false);
        return;
      }

      const data = { id: snap.id, ...snap.data() };
      setRequest(data);
      setLoading(false);
    });

    return () => unsub();
  }, [requestId]);

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
          .filter((u: any) => u.active !== false && u.archived !== true)
      );
    });

    return () => {
      unsubAmb();
      unsubUsers();
    };
  }, []);

  useEffect(() => {
    if (!request) return;

    setEditForm({
      requestType: request.requestType || "",
      customerName: request.customerName || "",
      customerMobile: request.customerMobile || "",
      patientName: request.patientName || "",
      patientAge: request.patientAge || "",
      patientGender: request.patientGender || "",
      patientIdOrIqama: request.patientIdOrIqama || "",
      requestedTransportAt: request.requestedTransportAt || "",
      pickupText: request.pickupText || "",
      pickupMapLink: request.pickupMapLink || "",
      pickupFloor: request.pickupFloor || "",
      destinationText: request.destinationText || "",
      destinationMapLink: request.destinationMapLink || "",
      destinationFloor: request.destinationFloor || "",
      patientStability: request.patientStability || "",
      transportLevel: request.transportLevel || "",
      mobility: request.mobility || "",
      diagnosisOrReason: request.diagnosisOrReason || "",
      operationalDecision:
        request.operationalDecision || "Approved - Proceed to Pricing",
      rejectionReason: request.rejectionReason || "",
      operationalNotes: request.operationalNotes || "",
      price: request.price || "",
      payer: request.payer || "",
      paymentStatus: request.paymentStatus || "Pending",
      customerApprovedPrice: request.customerApprovedPrice || "",
      paymentLinkSentAt: request.paymentLinkSentAt || "",
      bookingConfirmationNumber: request.bookingConfirmationNumber || "",
    });

    setAssignment({
      unitType: request.plannedAssignment?.unitType || "ambulance",
      unitId: request.plannedAssignment?.unitId || "",
      unitCode: request.plannedAssignment?.unitCode || "",
      unitName: request.plannedAssignment?.unitName || "",
      unitTypeName: request.plannedAssignment?.unitTypeName || "",
      assignedTeamGroup: request.plannedAssignment?.assignedTeamGroup || "",
      assignedUserIds: Array.isArray(request.plannedAssignment?.assignedUserIds)
        ? request.plannedAssignment.assignedUserIds
        : [],
    });
  }, [request]);

  const selectedAmbulance = useMemo(
    () => ambulances.find((a) => a.id === assignment.unitId),
    [ambulances, assignment.unitId]
  );

  const cadReady = request ? canCreateCadCase(request) : false;
  const withinOneHour = request ? isWithinOneHour(request) : false;

  const canEditRequest =
    Boolean(request) &&
    !request?.cadCaseId &&
    (canEditB2CRequest || canConfirmB2CPayment || canChangeB2CTeam);

  const canCreateCad =
    Boolean(request) &&
    !request?.cadCaseId &&
    cadReady &&
    canActivateB2CCad;

  const canOpenCad = Boolean(request?.cadCaseId);
  const assignedUserIds = Array.isArray(request?.plannedAssignment?.assignedUserIds)
  ? request.plannedAssignment.assignedUserIds
  : [];

const isAssignedToThisB2CRequest = Boolean(
  user?.uid && assignedUserIds.includes(user.uid)
);

const preparationAcknowledgement = request?.preparationAcknowledgement || {};

const requestPreparationAcknowledged = Boolean(
  preparationAcknowledgement?.acknowledged
);

const canAcknowledgeRequest =
  Boolean(request) &&
  !request?.cadCaseId &&
  isAssignedToThisB2CRequest &&
  !requestPreparationAcknowledged;

const canViewThisB2CRequest =
  canViewB2CRequest || isAssignedToThisB2CRequest;

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
    const matchedUser = users.find((u) => u.uid === userId || u.id === userId);

    if (matchedUser) {
      return (
        matchedUser.name ||
        matchedUser.displayName ||
        matchedUser.fullName ||
        matchedUser.email ||
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

    setAssignment({
      unitType: "ambulance",
      unitId,
      unitCode: ambulance?.code || ambulance?.name || unitId || "",
      unitName: ambulance?.name || "",
      unitTypeName: ambulance?.type || ambulance?.vehicleType || "Ambulance",
      assignedTeamGroup: getAmbulanceTeamGroup(ambulance),
      assignedUserIds: getAmbulanceTeamIds(ambulance),
    });
  }

  function updateEditField(name: string, value: string) {
    setEditForm((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSaveEdit() {
    if (!request) return;

    if (!canEditRequest) {
      alert("You do not have permission to edit this B2C request.");
      return;
    }

    if (
      !editForm.customerName ||
      !editForm.customerMobile ||
      !editForm.patientName ||
      !editForm.pickupText ||
      !editForm.destinationText
    ) {
      alert(
        "Please complete customer name, mobile, patient name, pickup, and destination."
      );
      return;
    }

    if (!assignment.unitId) {
      alert("Please select the planned ambulance.");
      return;
    }

    if (assignment.assignedUserIds.length === 0) {
      alert(
        "The selected ambulance has no assigned team. Please update ambulance profile or select another ambulance."
      );
      return;
    }

    setSaving(true);

    try {
      let requestStatus = request.requestStatus || "PendingPayment";

      if (editForm.operationalDecision?.startsWith("Rejected")) {
        requestStatus = "Rejected";
      } else if (request.cadCaseId) {
        requestStatus = "CadCreated";
      } else if (editForm.paymentStatus === "Paid") {
        requestStatus =
          editForm.requestType === "Immediate" ? "ReadyToActivate" : "Confirmed";
      } else {
        requestStatus = "PendingPayment";
      }

      await updateB2CRequest(request.id, {
        ...editForm,
        requestStatus,
        plannedAssignment: assignment,
      });

      setEditMode(false);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to update request.");
    } finally {
      setSaving(false);
    }
  }
  async function handleAcknowledgeRequest() {
  if (!request) return;

  if (!isAssignedToThisB2CRequest) {
    alert("You are not assigned to this B2C request.");
    return;
  }

  setAcknowledgingRequest(true);

  try {
    await updateB2CRequest(request.id, {
      preparationAcknowledgement: {
        acknowledged: true,
        acknowledgedBy: user?.uid || user?.id || "",
        acknowledgedByName:
          user?.name ||
          user?.displayName ||
          user?.fullName ||
          user?.email ||
          "Team Member",
        acknowledgedAt: serverTimestamp(),
      },
      preparationStatus: "Acknowledged",
      preparationAcknowledgedAt: serverTimestamp(),
      preparationAcknowledgedBy: user?.uid || user?.id || "",
      preparationAcknowledgedByName:
        user?.name ||
        user?.displayName ||
        user?.fullName ||
        user?.email ||
        "Team Member",
    });
  } catch (error: any) {
    console.error(error);
    alert(error?.message || "Failed to acknowledge request.");
  } finally {
    setAcknowledgingRequest(false);
  }
}

  async function handleCreateCad() {
    if (!request) return;

    if (!canActivateB2CCad) {
      alert("You do not have permission to create CAD case.");
      return;
    }

    setCreatingCad(true);

    try {
      const caseId = await createCadCaseFromB2CRequest(
        request.id,
        user?.uid || user?.id || "dispatch"
      );

      router.push(`/cases/${caseId}`);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to create CAD case.");
    } finally {
      setCreatingCad(false);
    }
  }

  console.log("B2C Permission Debug:", {
    userRoleFromUserDocument: user?.role,
    roleRawUsedForFirestoreRoleDoc: roleRaw,
    normalizedRoleForChecks: role,
    permissionsLoading,
    b2cPermissions: permissions?.b2c_requests,
    canViewB2CRequest,
    canEditB2CRequest,
    canConfirmB2CPayment,
    canChangeB2CTeam,
    canActivateB2CCad,
    isDispatch,
  });

  if (userLoading || loading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading request...</div>
      </div>
    );
  }

  if (permissionsLoading) {
    return (
      <div className="page-shell">
        <div className="card-modern">Loading permissions...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="page-shell">
        <div className="card-modern text-red-500">Request not found.</div>
      </div>
    );
  }

if (!canViewThisB2CRequest) {
  return (
    <div className="page-shell">
      <div className="card-modern text-red-500">
        You do not have permission to view this B2C request.
      </div>
    </div>
  );
}

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="badge mb-3">
            {isParamedic ? "Upcoming B2C Request" : "B2C Request"}
          </div>

          <h1 className="page-title">
            Request #{request.bookingConfirmationNumber || request.id}
          </h1>

          <p className="page-subtitle">
            This page is for request follow-up before the CAD case becomes
            active. Dispatch can edit, confirm payment, change ambulance/team,
            and create CAD.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canAcknowledgeRequest && (
  <button
    className="btn-primary"
    disabled={acknowledgingRequest}
    onClick={handleAcknowledgeRequest}
  >
    {acknowledgingRequest ? "Acknowledging..." : "Acknowledge Request"}
  </button>
)}
          {canOpenCad && (
            <button
              className="btn-primary"
              onClick={() =>
  router.push(
    isParamedic
      ? `/missions/${request.cadCaseId}`
      : `/cases/${request.cadCaseId}`
  )
}
            >
              {isParamedic ? "Open Mission" : "Open CAD Case"}
              <ArrowRight size={16} />
            </button>
          )}

          {canEditRequest && !editMode && (
            <button className="btn-secondary" onClick={() => setEditMode(true)}>
              <Edit3 size={16} />
              Edit Request
            </button>
          )}

          {editMode && (
            <>
              <button
                className="btn-secondary"
                disabled={saving}
                onClick={() => setEditMode(false)}
              >
                <X size={16} />
                Cancel
              </button>

              <button
                className="btn-primary"
                disabled={saving}
                onClick={handleSaveEdit}
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}

          {canCreateCad && (
            <button
              className="btn-primary"
              disabled={creatingCad}
              onClick={handleCreateCad}
            >
              {creatingCad ? "Creating CAD..." : "Create CAD Case"}
            </button>
          )}
        </div>
      </div>

      {!isDispatch && !request.cadCaseId && (
        <div className="notice-warning">
          This is an upcoming request only. CAD is not active yet. Operational
          buttons will appear after Dispatch creates the CAD case.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_390px]">
        <div className="space-y-5">
          <Section title="Customer & Patient" icon={<UserRound size={18} />}>
            {editMode ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <EditInput
                  label="Customer Name"
                  value={editForm.customerName}
                  onChange={(v) => updateEditField("customerName", v)}
                />
                <EditInput
                  label="Customer Mobile"
                  value={editForm.customerMobile}
                  onChange={(v) => updateEditField("customerMobile", v)}
                />
                <EditInput
                  label="Patient Name"
                  value={editForm.patientName}
                  onChange={(v) => updateEditField("patientName", v)}
                />
                <EditInput
                  label="Age"
                  value={editForm.patientAge}
                  onChange={(v) => updateEditField("patientAge", v)}
                />
                <EditSelect
                  label="Gender"
                  value={editForm.patientGender}
                  onChange={(v) => updateEditField("patientGender", v)}
                  options={["Male", "Female"]}
                />
                <EditInput
                  label="ID / Iqama"
                  value={editForm.patientIdOrIqama}
                  onChange={(v) => updateEditField("patientIdOrIqama", v)}
                />
              </div>
            ) : (
              <>
                <Info label="Customer Name" value={request.customerName} />
                <Info label="Customer Mobile" value={request.customerMobile} />
                <Info label="Patient Name" value={request.patientName} />
                <Info label="Age" value={request.patientAge} />
                <Info label="Gender" value={request.patientGender} />
                <Info label="ID / Iqama" value={request.patientIdOrIqama} />
              </>
            )}
          </Section>

          <Section title="Trip Details" icon={<MapPin size={18} />}>
            {editMode ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <EditSelect
                  label="Request Type"
                  value={editForm.requestType}
                  onChange={(v) => updateEditField("requestType", v)}
                  options={["Scheduled", "Immediate"]}
                />
                <EditInput
                  label="Transport Date / Time"
                  type="datetime-local"
                  value={editForm.requestedTransportAt}
                  onChange={(v) => updateEditField("requestedTransportAt", v)}
                />
                <EditInput
                  label="Pickup"
                  value={editForm.pickupText}
                  onChange={(v) => updateEditField("pickupText", v)}
                />
                <EditInput
                  label="Pickup Link"
                  value={editForm.pickupMapLink}
                  onChange={(v) => updateEditField("pickupMapLink", v)}
                />
                <EditInput
                  label="Pickup Floor"
                  value={editForm.pickupFloor}
                  onChange={(v) => updateEditField("pickupFloor", v)}
                />
                <EditInput
                  label="Destination"
                  value={editForm.destinationText}
                  onChange={(v) => updateEditField("destinationText", v)}
                />
                <EditInput
                  label="Destination Link"
                  value={editForm.destinationMapLink}
                  onChange={(v) => updateEditField("destinationMapLink", v)}
                />
                <EditInput
                  label="Destination Floor"
                  value={editForm.destinationFloor}
                  onChange={(v) => updateEditField("destinationFloor", v)}
                />
              </div>
            ) : (
              <>
                <Info label="Request Type" value={request.requestType} />
                <Info
                  label="Transport Date / Time"
                  value={request.requestedTransportAt}
                />
                <Info label="Pickup" value={request.pickupText} />
                <Info label="Pickup Link" value={request.pickupMapLink} />
                <Info label="Pickup Floor" value={request.pickupFloor} />
                <Info label="Destination" value={request.destinationText} />
                <Info
                  label="Destination Link"
                  value={request.destinationMapLink}
                />
                <Info
                  label="Destination Floor"
                  value={request.destinationFloor}
                />
              </>
            )}
          </Section>

          <Section
            title="Clinical & Operational Screening"
            icon={<ShieldCheck size={18} />}
          >
            {editMode ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <EditSelect
                  label="Patient Stability"
                  value={editForm.patientStability}
                  onChange={(v) => updateEditField("patientStability", v)}
                  options={[
                    "Conscious and Stable",
                    "Needs Monitoring",
                    "Critical - Refer to 997",
                  ]}
                />
                <EditSelect
                  label="Transport Level"
                  value={editForm.transportLevel}
                  onChange={(v) => updateEditField("transportLevel", v)}
                  options={["BLS - Stable", "ALS - Advanced Medical Support"]}
                />
                <EditSelect
                  label="Mobility"
                  value={editForm.mobility}
                  onChange={(v) => updateEditField("mobility", v)}
                  options={["Walking", "Wheelchair", "Bedridden"]}
                />
                <EditSelect
                  label="Operational Decision"
                  value={editForm.operationalDecision}
                  onChange={(v) => updateEditField("operationalDecision", v)}
                  options={[
                    "Approved - Proceed to Pricing",
                    "Escalate to Medical Director",
                    "Rejected - Document Reason",
                  ]}
                />
                <div className="md:col-span-2">
                  <EditTextarea
                    label="Diagnosis / Reason"
                    value={editForm.diagnosisOrReason}
                    onChange={(v) => updateEditField("diagnosisOrReason", v)}
                  />
                </div>
                <div className="md:col-span-2">
                  <EditTextarea
                    label="Operational Notes"
                    value={editForm.operationalNotes}
                    onChange={(v) => updateEditField("operationalNotes", v)}
                  />
                </div>
                {editForm.operationalDecision?.startsWith("Rejected") && (
                  <div className="md:col-span-2">
                    <EditInput
                      label="Rejection Reason"
                      value={editForm.rejectionReason}
                      onChange={(v) => updateEditField("rejectionReason", v)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                <Info
                  label="Patient Stability"
                  value={request.patientStability}
                />
                <Info label="Transport Level" value={request.transportLevel} />
                <Info label="Mobility" value={request.mobility} />
                <Info
                  label="Special Requirements"
                  value={
                    Array.isArray(request.specialRequirements)
                      ? request.specialRequirements.join(", ")
                      : request.specialRequirements
                  }
                />
                <Info
                  label="Diagnosis / Reason"
                  value={request.diagnosisOrReason}
                />
                <Info
                  label="Operational Decision"
                  value={request.operationalDecision}
                />
                <Info label="Rejection Reason" value={request.rejectionReason} />
              </>
            )}
          </Section>
        </div>

        <div className="space-y-5">
<Section title="Request Status" icon={<CalendarClock size={18} />}>
  <StatusBadge label="Request Status" value={request.requestStatus} />

  <StatusBadge label="Payment Status" value={request.paymentStatus} />

  <StatusBadge
    label="CAD Status"
    value={request.cadCaseId ? "CAD Created" : "Not Created"}
  />

  <StatusBadge
    label="Preparation"
    value={
      requestPreparationAcknowledged
        ? `Acknowledged by ${
            preparationAcknowledgement?.acknowledgedByName ||
            request.preparationAcknowledgedByName ||
            "Team"
          }`
        : "Pending"
    }
  />

  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
    {request.cadCaseId
      ? "CAD case is already created."
      : cadReady
      ? "This request is ready to create CAD case."
      : "CAD is locked until payment is paid and request is approved."}
  </div>

  {!request.cadCaseId && withinOneHour && cadReady && (
    <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-700 dark:text-amber-200">
      This trip is within one hour. CAD should be activated now.
    </div>
  )}
</Section>

          <Section title="Payment" icon={<CreditCard size={18} />}>
            {editMode ? (
              <div className="space-y-4">
                <EditInput
                  label="Price"
                  value={editForm.price}
                  onChange={(v) => updateEditField("price", v)}
                />
                <EditInput
                  label="Payer"
                  value={editForm.payer}
                  onChange={(v) => updateEditField("payer", v)}
                />
                <EditSelect
                  label="Payment Status"
                  value={editForm.paymentStatus}
                  onChange={(v) => updateEditField("paymentStatus", v)}
                  options={["Pending", "Paid"]}
                />
                <EditSelect
                  label="Customer Approved Price"
                  value={editForm.customerApprovedPrice}
                  onChange={(v) => updateEditField("customerApprovedPrice", v)}
                  options={["No", "Yes - Send Payment Link"]}
                />
                <EditInput
                  label="Payment Link Sent At"
                  type="datetime-local"
                  value={editForm.paymentLinkSentAt}
                  onChange={(v) => updateEditField("paymentLinkSentAt", v)}
                />
                <EditInput
                  label="Booking Confirmation Number"
                  value={editForm.bookingConfirmationNumber}
                  onChange={(v) =>
                    updateEditField("bookingConfirmationNumber", v)
                  }
                />
              </div>
            ) : (
              <>
                <Info
                  label="Price"
                  value={request.price ? `${request.price} SAR` : "—"}
                />
                <Info label="Payer" value={request.payer} />
                <Info
                  label="Payment Link Sent At"
                  value={request.paymentLinkSentAt}
                />
                <Info
                  label="Customer Approved Price"
                  value={request.customerApprovedPrice}
                />
              </>
            )}
          </Section>

          <Section title="Planned Assignment" icon={<Ambulance size={18} />}>
            {editMode ? (
              <div className="space-y-4">
                <EditSelect
                  label="Planned Ambulance / Unit"
                  value={assignment.unitId}
                  onChange={handleAmbulanceChange}
                  options={[
                    { label: "Select ambulance", value: "" },
                    ...ambulances.map((a) => ({
                      label: a.code || a.name || a.id,
                      value: a.id,
                    })),
                  ]}
                />

                {assignment.unitId && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Team Group
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                      {assignment.assignedTeamGroup || "—"}
                    </div>

                    <div className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Team Members
                    </div>

                    <div className="mt-2 space-y-2">
                      {assignment.assignedUserIds.length > 0 ? (
                        assignment.assignedUserIds.map((userId) => (
                          <div
                            key={userId}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:bg-[#0b1220] dark:text-white"
                          >
                            {getUserDisplayName(userId)}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-red-500">
                          No team linked to this ambulance.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Info
                  label="Unit"
                  value={
                    request.plannedAssignment?.unitCode ||
                    request.plannedAssignment?.unitId ||
                    "—"
                  }
                />
                <Info
                  label="Team Group"
                  value={request.plannedAssignment?.assignedTeamGroup || "—"}
                />
                <Info
                  label="Assigned Users"
                  value={
                    Array.isArray(request.plannedAssignment?.assignedUserIds)
                      ? request.plannedAssignment.assignedUserIds
                          .map((id: string) => getUserDisplayName(id))
                          .join(", ")
                      : "—"
                  }
                />
              </>
            )}

            {request.cadCaseId ? (
              <button
                className="btn-primary mt-4 w-full"
                onClick={() =>
  router.push(
    isParamedic
      ? `/missions/${request.cadCaseId}`
      : `/cases/${request.cadCaseId}`
  )
}
              >
                {isParamedic ? "Open Mission" : "Open CAD Case"}
                <ArrowRight size={16} />
              </button>
            ) : canCreateCad ? (
              <button
                className="btn-primary mt-4 w-full"
                disabled={!cadReady || creatingCad || editMode}
                onClick={handleCreateCad}
              >
                {creatingCad ? "Creating CAD..." : "Create CAD Case"}
              </button>
            ) : (
              <div className="notice-warning mt-4">
                CAD is not active yet or you do not have permission to create
                CAD.
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card-modern">
      <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
        <span className="text-blue-500">{icon}</span>
        {title}
      </div>

      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-white">
        {value || "—"}
      </div>
    </div>
  );
}

function StatusBadge({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-300">
        {value || "—"}
      </span>
    </div>
  );
}

function EditInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="input"
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function EditTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <textarea
        className="textarea"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[] | { label: string; value: string }[];
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select
        className="select"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option: any) => {
          const label = typeof option === "string" ? option : option.label;
          const value = typeof option === "string" ? option : option.value;

          return (
            <option key={value || label} value={value}>
              {label}
            </option>
          );
        })}
      </select>
    </div>
  );
}