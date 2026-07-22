"use client";

import { useState, type ReactNode } from "react";
import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =============================
   TYPES
============================= */
type CaseLocation = {
  lat?: number;
  lng?: number;
  address?: string;
  text?: string;
  googleMapLink?: string;
};

type ProjectHospital = {
  id: string;
  name: string;
  type: "hospital" | "clinic";
  lat?: number | null;
  lng?: number | null;
  address?: string;
};

type B2CDestination = {
  id?: string;
  name?: string;
  text?: string;
  hospitalName?: string;
  type?: string;
  lat?: number | null;
  lng?: number | null;
  address?: string;
  googleMapLink?: string;
  floor?: string;
};

type Destination = {
  id: string;
  name: string;
  type: "hospital" | "clinic";
  lat: number;
  lng: number;
  address?: string;
  googleMapLink?: string;
  hospitalName?: string;
  floor?: string;
};

type StatusButtonsProps = {
  caseId: string;
  currentStatus: string;
  caseLocation?: CaseLocation;
  projectHospitals?: ProjectHospital[];

  /**
   * PROJECT / B2C / GENERAL
   * For old project flow, it will still use projectHospitals list.
   * For B2C, it will use b2cDestination directly.
   */
  sourceType?: string;
  caseType?: string;

  /**
   * Destination coming from B2C CAD case.
   * Example:
   * {
   *   hospitalName: "King Saud Medical City",
   *   text: "King Saud Medical City",
   *   googleMapLink: "...",
   *   lat: 24.7,
   *   lng: 46.6
   * }
   */
  b2cDestination?: B2CDestination;

  /**
   * Fallback if the B2C case has flat destination fields.
   */
  destinationHospitalName?: string;
  destinationText?: string;
  destinationMapLink?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationFloor?: string;

onDestinationSelected?: (destination: any) => void;};

const STATUSES = [
  "Received",
  "Assigned",
  "EnRoute",
  "OnScene",
  "Transporting",
  "Hospital",
  "Closed",
] as const;

/* =============================
   HELPERS
============================= */
function isB2CCase(sourceType?: string, caseType?: string) {
  return sourceType === "B2C" || caseType === "B2C";
}

/**
 * A cancelled CAD case is terminal, just like a closed case.
 * The B2C request cancellation workflow updates the CAD status directly.
 */
function isFinalCaseStatus(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();

  return normalized === "closed" || normalized === "cancelled";
}

function buildB2CDestination({
  b2cDestination,
  destinationHospitalName,
  destinationText,
  destinationMapLink,
  destinationLat,
  destinationLng,
  destinationFloor,
}: {
  b2cDestination?: B2CDestination;
  destinationHospitalName?: string;
  destinationText?: string;
  destinationMapLink?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationFloor?: string;
}): Destination | null {
  const name =
    b2cDestination?.hospitalName ||
    b2cDestination?.name ||
    b2cDestination?.text ||
    destinationHospitalName ||
    destinationText ||
    "";

  if (!name.trim()) return null;

return {
  id: b2cDestination?.id || "b2c-destination",
  name,
  type: "hospital",
lat:
  typeof b2cDestination?.lat === "number"
    ? b2cDestination.lat
    : typeof destinationLat === "number"
    ? destinationLat
    : 0,
lng:
  typeof b2cDestination?.lng === "number"
    ? b2cDestination.lng
    : typeof destinationLng === "number"
    ? destinationLng
    : 0,
    address: b2cDestination?.address || "",
    googleMapLink: b2cDestination?.googleMapLink || destinationMapLink || "",
    hospitalName: b2cDestination?.hospitalName || destinationHospitalName || name,
    floor: b2cDestination?.floor || destinationFloor || "",
  };
}

/* =============================
   COMPONENT
============================= */
export default function StatusButtons({
  caseId,
  currentStatus,
  caseLocation,
  projectHospitals = [],

  sourceType,
  caseType,

  b2cDestination,
  destinationHospitalName,
  destinationText,
  destinationMapLink,
  destinationLat,
  destinationLng,
  destinationFloor,

  onDestinationSelected,
}: StatusButtonsProps) {
  const [showTypePopup, setShowTypePopup] = useState(false);
  const [destinationType, setDestinationType] =
    useState<"hospital" | "clinic" | null>(null);
  const [showDestinationList, setShowDestinationList] = useState(false);
  const [showB2CConfirm, setShowB2CConfirm] = useState(false);

  const currentIsB2C = isB2CCase(sourceType, caseType);
  const isFinalStatus = isFinalCaseStatus(currentStatus);

  const resolvedB2CDestination = buildB2CDestination({
    b2cDestination,
    destinationHospitalName,
    destinationText,
    destinationMapLink,
    destinationLat,
    destinationLng,
    destinationFloor,
  });

  /* =============================
     BASIC STATUS UPDATE
  ============================= */
  const updateStatus = async (newStatus: string) => {
    if (isFinalCaseStatus(currentStatus)) return;

    /**
     * Special handling for Transporting:
     *
     * PROJECT:
     * - Keep old flow
     * - Show hospital / clinic popup
     * - User selects from projectHospitals
     *
     * B2C:
     * - Do not show project hospitals
     * - Use the destination already saved from B2C request
     */
    if (newStatus === "Transporting") {
      if (currentIsB2C) {
        if (!resolvedB2CDestination) {
          alert(
            "B2C destination hospital is missing. Please update the B2C request or CAD case destination first."
          );
          return;
        }

        setShowB2CConfirm(true);
        return;
      }

      if (!caseLocation) {
        alert("Patient location is missing");
        return;
      }

      if (!projectHospitals || projectHospitals.length === 0) {
        alert("No hospitals or clinics registered for this project.");
        return;
      }

      setShowTypePopup(true);
      return;
    }

    await updateDoc(doc(db, "cases", caseId), {
      status: newStatus,
      [`timeline.${newStatus}`]: serverTimestamp(),
    });
  };

  /* =============================
     B2C TRANSPORTING CONFIRM
  ============================= */
  const confirmB2CTransporting = async () => {
    if (!resolvedB2CDestination) {
      alert("B2C destination is missing.");
      return;
    }

    await updateDoc(doc(db, "cases", caseId), {
      status: "Transporting",

      destination: {
        id: resolvedB2CDestination.id,
        name: resolvedB2CDestination.name,
        text: resolvedB2CDestination.name,
        type: "hospital",
        hospitalName:
          resolvedB2CDestination.hospitalName || resolvedB2CDestination.name,
        lat: resolvedB2CDestination.lat ?? null,
        lng: resolvedB2CDestination.lng ?? null,
        address: resolvedB2CDestination.address || "",
        googleMapLink: resolvedB2CDestination.googleMapLink || "",
        floor: resolvedB2CDestination.floor || "",
      },

      destinationHospitalName:
        resolvedB2CDestination.hospitalName || resolvedB2CDestination.name,
      destinationText: resolvedB2CDestination.name,
      destinationMapLink: resolvedB2CDestination.googleMapLink || "",
      destinationLat: resolvedB2CDestination.lat ?? null,
      destinationLng: resolvedB2CDestination.lng ?? null,
      destinationFloor: resolvedB2CDestination.floor || "",

      [`timeline.Transporting`]: serverTimestamp(),
    });

    onDestinationSelected?.(resolvedB2CDestination);

    setShowB2CConfirm(false);
  };

  /* =============================
     OPEN PROJECT DESTINATION LIST
  ============================= */
  const openDestinationList = (type: "hospital" | "clinic") => {
    setDestinationType(type);
    setShowTypePopup(false);
    setShowDestinationList(true);
  };

  /* =============================
     SELECT PROJECT DESTINATION
  ============================= */
  const selectDestination = async (destination: ProjectHospital) => {
    const hasLocation =
      typeof destination.lat === "number" &&
      typeof destination.lng === "number";

    if (!hasLocation) {
      alert("This destination is missing location coordinates.");
      return;
    }

    const cleanDestination: Destination = {
      id: destination.id,
      name: destination.name,
      type: destination.type,
      lat: destination.lat as number,
      lng: destination.lng as number,
      address: destination.address || "",
      hospitalName: destination.type === "hospital" ? destination.name : "",
    };

    await updateDoc(doc(db, "cases", caseId), {
      status: "Transporting",

      destination: {
        id: cleanDestination.id,
        name: cleanDestination.name,
        text: cleanDestination.name,
        type: cleanDestination.type,
        hospitalName: cleanDestination.hospitalName || "",
        lat: cleanDestination.lat ?? null,
        lng: cleanDestination.lng ?? null,
        address: cleanDestination.address || "",
      },

      destinationHospitalName:
        cleanDestination.type === "hospital" ? cleanDestination.name : "",
      destinationText: cleanDestination.name,
      destinationLat: cleanDestination.lat ?? null,
      destinationLng: cleanDestination.lng ?? null,

      [`timeline.Transporting`]: serverTimestamp(),
    });

    onDestinationSelected?.(cleanDestination);

    setShowDestinationList(false);
    setDestinationType(null);
  };

  const filteredProjectDestinations = projectHospitals.filter((d) => {
    if (!destinationType) return false;
    return d.type === destinationType;
  });

  /* =============================
     RENDER
  ============================= */
  return (
    <div>
      <h3 className="mb-2 font-black text-[#274C5A]">Update Status</h3>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        {STATUSES.map((s) => (
          <button
            key={s}
            disabled={isFinalStatus}
            onClick={() => updateStatus(s)}
            className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
              currentStatus === s
                ? "bg-emerald-600 text-white"
                : "border border-[#86A7B2]/35 bg-white text-[#274C5A] hover:border-[#274C5A]/45 hover:bg-[#f8fbfc]"
            } ${
              isFinalStatus
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {currentStatus === "Cancelled" && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          This CAD case has been cancelled. Status changes are locked.
        </div>
      )}

      {/* =============================
         B2C DESTINATION CONFIRM
      ============================= */}
      {showB2CConfirm && resolvedB2CDestination && (
        <Modal>
          <h2 className="mb-4 text-center text-lg font-black text-[#274C5A]">
            Confirm Transporting
          </h2>

          <p className="mb-4 text-center text-sm text-[#7F7F7F]">
            This is a B2C case. The destination will be taken from the B2C
            request.
          </p>

          <div className="mb-4 rounded-xl border border-[#86A7B2]/25 bg-[#f8fbfc] p-4">
            <div className="mb-1 text-xs font-bold text-[#7F7F7F]">Destination Hospital</div>
            <div className="font-black text-[#274C5A]">
              {resolvedB2CDestination.hospitalName ||
                resolvedB2CDestination.name}
            </div>

            {resolvedB2CDestination.googleMapLink && (
              <a
                href={resolvedB2CDestination.googleMapLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm font-bold text-[#274C5A] underline"
              >
                Open Destination Map
              </a>
            )}

            {resolvedB2CDestination.floor && (
              <div className="mt-2 text-xs text-[#7F7F7F]">
                Floor: {resolvedB2CDestination.floor}
              </div>
            )}
          </div>

          <button
            onClick={confirmB2CTransporting}
            className="mb-2 w-full rounded-xl bg-[#274C5A] p-2 font-bold text-white hover:bg-[#1f3f4c]"
          >
            Confirm Transporting
          </button>

          <button
            onClick={() => setShowB2CConfirm(false)}
            className="mt-2 w-full text-sm font-bold text-[#7F7F7F] hover:text-[#274C5A]"
          >
            Cancel
          </button>
        </Modal>
      )}

      {/* =============================
         PROJECT DESTINATION TYPE POPUP
      ============================= */}
      {showTypePopup && (
        <Modal>
          <h2 className="mb-4 text-lg font-black text-[#274C5A]">Transporting To?</h2>

          <button
            onClick={() => openDestinationList("hospital")}
            className="mb-2 w-full rounded-xl bg-[#274C5A] p-2 font-bold text-white hover:bg-[#1f3f4c]"
          >
            Hospital
          </button>

          <button
            onClick={() => openDestinationList("clinic")}
            className="w-full rounded-xl bg-emerald-600 p-2 font-bold text-white hover:bg-emerald-700"
          >
            Clinic
          </button>

          <button
            onClick={() => setShowTypePopup(false)}
            className="mt-4 w-full text-sm font-bold text-[#7F7F7F] hover:text-[#274C5A]"
          >
            Cancel
          </button>
        </Modal>
      )}

      {/* =============================
         PROJECT DESTINATION LIST
      ============================= */}
      {showDestinationList && (
        <Modal>
          <h2 className="mb-4 text-center text-lg font-black text-[#274C5A]">
            Select Project Destination
          </h2>

          <p className="mb-3 text-center text-xs text-[#7F7F7F]">
            Showing only destinations registered on this project.
          </p>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredProjectDestinations.length === 0 ? (
              <div className="rounded-xl border border-red-500/30 bg-red-50 p-3 text-sm font-semibold text-red-700">
                No {destinationType} registered for this project.
              </div>
            ) : (
              filteredProjectDestinations.map((d) => {
                const hasLocation =
                  typeof d.lat === "number" &&
                  typeof d.lng === "number";

                return (
                  <button
                    key={d.id}
                    disabled={!hasLocation}
                    onClick={() => selectDestination(d)}
                    className={`w-full text-left p-3 rounded border transition ${
                      hasLocation
                        ? "border-[#274C5A]/30 bg-[#274C5A] text-white hover:bg-[#1f3f4c]"
                        : "cursor-not-allowed border-red-500/30 bg-red-50 text-red-700"
                    }`}
                  >
                    <div className="font-semibold">{d.name}</div>

                    <div className="text-xs opacity-80">
                      {d.type}
                      {d.address ? ` • ${d.address}` : ""}
                    </div>

                    {!hasLocation && (
                      <div className="mt-1 text-xs text-red-700">
                        Missing location coordinates
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <button
            onClick={() => {
              setShowDestinationList(false);
              setDestinationType(null);
            }}
            className="mt-4 w-full text-sm font-bold text-[#7F7F7F] hover:text-[#274C5A]"
          >
            Cancel
          </button>
        </Modal>
      )}
    </div>
  );
}

/* =============================
   SIMPLE MODAL
============================= */
function Modal({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#274C5A]/55 p-4 backdrop-blur-sm">
      <div className="w-96 max-w-[90vw] rounded-2xl border border-[#86A7B2]/35 bg-white p-6 text-[#274C5A] shadow-2xl shadow-[#274C5A]/20">
        {children}
      </div>
    </div>
  );
}
