// app/(protected)/transport/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { TransportRequest, TeamRow } from "../types";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { inputClass, selectClass, textareaClass } from "../ui";
import { sendEmail } from "../emailClient";
import { buildEmail } from "../emailTemplates";

type ProjectType = "coverage" | "transporting";
type ServiceType = "ALS" | "BLS";

/**
 * NOTE:
 * - We use TeamRow["composition"] from ../types to avoid type mismatch.
 * - TEAM_COMPOSITION_LABEL keys MUST match the union in TeamRow["composition"].
 */
const TEAM_COMPOSITION_LABEL: Record<TeamRow["composition"], string> = {
  doctor_emt: "Doctor",
  paramedic: "Paramedic",
  emt_paramedic: "EMT",
  driver_paramedic: "Driver",
  nurse_doctor: "Nurse",
};

export default function TransportNewPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ✅ Service Details
  const [projectType, setProjectType] = useState<ProjectType>("transporting");
  const [serviceType, setServiceType] = useState<ServiceType>("ALS");
  const [serviceStart, setServiceStart] = useState("");
  const [serviceEnd, setServiceEnd] = useState("");
  const [requirements, setRequirements] = useState("");

  // ✅ Required Resources (Teams)
  const [teams, setTeams] = useState<TeamRow[]>([
    { composition: "emt_paramedic", qty: 1 },
  ]);

  // ✅ Ambulance
  const [ambulanceNeeded, setAmbulanceNeeded] = useState(true);
  const [ambulanceCount, setAmbulanceCount] = useState<number>(1);

  // ✅ Roaming
  const [roamingNeeded, setRoamingNeeded] = useState(false);
  const [roamingCount, setRoamingCount] = useState<number>(1);

  const [daysCount, setDaysCount] = useState<number>(1);
  const [hoursCount, setHoursCount] = useState<number>(8);

  // ✅ Location
  const [cityScope, setCityScope] = useState<"inside" | "outside">("inside");
  const [cityName, setCityName] = useState("");

  const canCreate = useMemo(() => {
    return !!user?.uid && user?.active === true;
  }, [user]);

  const totalTeamCount = useMemo(() => {
    return teams.reduce((sum, t) => sum + (Number(t.qty) || 0), 0);
  }, [teams]);

  // Helper: send email safely (recipientGroup always LAST)
  function fireEmail(
    recipientGroup: "OPS" | "SALES",
    args: Parameters<typeof buildEmail>[0]
  ) {
    try {
      const email = buildEmail(args);
      void sendEmail({ ...email, recipientGroup }).catch(console.error);
    } catch (e) {
      console.error("buildEmail failed:", e);
    }
  }

  async function onSubmit() {
    setError("");

    if (!canCreate) return setError("You do not have permission to create a request.");
    if (!projectType) return setError("Project type is required.");
    if (!serviceType) return setError("Service type is required.");
    if (!serviceStart) return setError("Service start date/time is required.");
    if (!serviceEnd) return setError("Service end date/time is required.");
    if (!cityName.trim()) return setError("City name is required.");

    const start = new Date(serviceStart);
    const end = new Date(serviceEnd);

    if (Number.isNaN(start.getTime())) return setError("Invalid service start date/time.");
    if (Number.isNaN(end.getTime())) return setError("Invalid service end date/time.");
    if (end.getTime() <= start.getTime())
      return setError("End date/time must be after start date/time.");

    if (!teams.length) return setError("At least one team is required.");
    if (teams.some((t) => (Number(t.qty) || 0) <= 0))
      return setError("Team quantity must be greater than 0.");

    if (ambulanceNeeded && ambulanceCount <= 0)
      return setError("Ambulance count must be greater than 0.");
    if (roamingNeeded && roamingCount <= 0)
      return setError("Roaming count must be greater than 0.");

    setSubmitting(true);

    try {
      const payload: TransportRequest = {
        // Service Details
        projectType,
        serviceType,
        serviceStartTime: start.toISOString(),
        serviceEndTime: end.toISOString(),
        serviceTime: start.toISOString(), // legacy
        requirements: requirements.trim(),

         // ✅ NEW: Sales owner (who created the request)
  salesOwnerUid: user!.uid,
  salesOwnerEmail: (user as any)?.email || "",

        // Resources (Teams)
        teamNeeded: teams.length > 0,
        teams, // NEW
        teamCount: totalTeamCount, // legacy summary
        teamComposition: (teams[0]?.composition as any) || ("none" as any), // legacy summary
        teamType: serviceType, // legacy

        // Ambulance
        ambulanceNeeded,
        ambulanceCount: ambulanceNeeded ? Number(ambulanceCount || 0) : 0,

        // Roaming
        roamingNeeded,
        roamingCount: roamingNeeded ? Number(roamingCount || 0) : 0,

        // Duration
        daysCount: Number(daysCount || 0),
        hoursCount: Number(hoursCount || 0),

        // Location
        cityScope,
        cityName: cityName.trim(),

        // Workflow
        status: "new",

        // Audit
        createdAt: serverTimestamp(),
        createdBy: user!.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user!.uid,
      };

      const docRef = await addDoc(collection(db, "transport_requests"), payload);

      // ✅ SEND EMAIL TO OPS (use safe payload for email)
      fireEmail("OPS", {
        type: "CREATED",
        req: { ...payload, status: "new" } as any,
        id: docRef.id,
      });

      // ✅ Navigate once
      router.push(`/transport/${docRef.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to save the request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 text-white">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">New Transport Request</h1>
        <p className="text-sm text-white/70">Created by Sales (Phase 1).</p>
      </div>

      {loading ? (
        <div className="text-sm text-white/70">Loading...</div>
      ) : !canCreate ? (
        <div className="rounded-xl bg-red-500/10 p-4 text-sm ring-1 ring-red-500/20">
          You do not have permission.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ✅ Service Details */}
          <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <h2 className="mb-3 text-sm font-semibold text-white/80">Service Details</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="block text-xs text-white/70">Project Type</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value as ProjectType)}
                  className={selectClass}
                >
                  <option value="coverage">Coverage</option>
                  <option value="transporting">Transporting</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs text-white/70">Service Type</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as ServiceType)}
                  className={selectClass}
                >
                  <option value="ALS">ALS</option>
                  <option value="BLS">BLS</option>
                </select>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-white/70">Start date/time</label>
                <input
                  type="datetime-local"
                  value={serviceStart}
                  onChange={(e) => setServiceStart(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs text-white/70">End date/time</label>
                <input
                  type="datetime-local"
                  value={serviceEnd}
                  onChange={(e) => setServiceEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <label className="mt-3 block text-xs text-white/70">Service Requirements</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className={textareaClass}
              placeholder="Any details requested by the client..."
            />
          </div>

          {/* ✅ Required Resources */}
          <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <h2 className="mb-3 text-sm font-semibold text-white/80">
              Required Resources (Requested)
            </h2>

            {/* Teams */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Teams</div>

                <button
                  type="button"
                  onClick={() =>
                    setTeams((prev) => [...prev, { composition: "paramedic", qty: 1 }])
                  }
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium ring-1 ring-white/15 hover:bg-white/15"
                >
                  + Add new team
                </button>
              </div>

              {teams.map((t, idx) => (
                <div key={idx} className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs text-white/70">Team required</label>
                    <select
                      value={t.composition}
                      onChange={(e) => {
                        const v = e.target.value as TeamRow["composition"];
                        setTeams((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, composition: v } : row))
                        );
                      }}
                      className={selectClass}
                    >
                      {(Object.keys(TEAM_COMPOSITION_LABEL) as Array<TeamRow["composition"]>).map(
                        (k) => (
                          <option key={k} value={k}>
                            {TEAM_COMPOSITION_LABEL[k]}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="w-full">
                      <label className="block text-xs text-white/70">Team quantity</label>
                      <input
                        type="number"
                        value={t.qty}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setTeams((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, qty: v } : row))
                          );
                        }}
                        className={inputClass}
                      />
                    </div>

                    {teams.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setTeams((prev) => prev.filter((_, i) => i !== idx))}
                        className="h-9 rounded-lg bg-red-500/15 px-3 text-xs font-medium ring-1 ring-red-500/25 hover:bg-red-500/20"
                        title="Remove"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}

              <div className="text-xs text-white/60">
                Total teams quantity: <span className="text-white/80">{totalTeamCount}</span>
              </div>
            </div>

            {/* Ambulance */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm">Ambulance required?</span>
              <input
                type="checkbox"
                checked={ambulanceNeeded}
                onChange={(e) => setAmbulanceNeeded(e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70">Ambulance count</label>
                <input
                  type="number"
                  value={ambulanceCount}
                  onChange={(e) => setAmbulanceCount(Number(e.target.value))}
                  disabled={!ambulanceNeeded}
                  className={`${inputClass} disabled:opacity-50`}
                />
              </div>
              <div />
            </div>

            {/* Roaming */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm">Roaming required?</span>
              <input
                type="checkbox"
                checked={roamingNeeded}
                onChange={(e) => setRoamingNeeded(e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70">Roaming count</label>
                <input
                  type="number"
                  value={roamingCount}
                  onChange={(e) => setRoamingCount(Number(e.target.value))}
                  disabled={!roamingNeeded}
                  className={`${inputClass} disabled:opacity-50`}
                />
              </div>
              <div />
            </div>

            {/* Days / Hours */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70">Days</label>
                <input
                  type="number"
                  value={daysCount}
                  onChange={(e) => setDaysCount(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-white/70">Hours</label>
                <input
                  type="number"
                  value={hoursCount}
                  onChange={(e) => setHoursCount(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ✅ Location */}
          <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-white/80">Location</h2>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-xs text-white/70">City scope</label>
                <select
                  value={cityScope}
                  onChange={(e) => setCityScope(e.target.value as any)}
                  className={selectClass}
                >
                  <option value="inside">Inside City</option>
                  <option value="outside">Outside City</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-white/70">City name</label>
                <input
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g., Riyadh"
                />
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm ring-1 ring-red-500/20">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={onSubmit}
                disabled={submitting}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save Request"}
              </button>
              <button
                onClick={() => router.push("/transport")}
                className="rounded-lg bg-transparent px-4 py-2 text-sm text-white/70 ring-1 ring-white/10 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
