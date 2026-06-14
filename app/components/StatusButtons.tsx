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
  type: "hospital" | "clinic" | "b2c";
  lat?: number | null;
  lng?: number | null;
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

  onDestinationSelected?: (destination: Destination) => void;
};

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
    type: "b2c",
    lat:
      typeof b2cDestination?.lat === "number"
        ? b2cDestination.lat
        : typeof destinationLat === "number"
        ? destinationLat
        : null,
    lng:
      typeof b2cDestination?.lng === "number"
        ? b2cDestination.lng
        : typeof destinationLng === "number"
        ? destinationLng
        : null,
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
    if (currentStatus === "Closed") return;

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
      <h3 className="font-bold mb-2 text-white">Update Status</h3>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        {STATUSES.map((s) => (
          <button
            key={s}
            disabled={currentStatus === "Closed"}
            onClick={() => updateStatus(s)}
            className={`py-2 rounded text-white font-medium transition ${
              currentStatus === s
                ? "bg-green-600"
                : "bg-blue-600 hover:bg-blue-700"
            } ${
              currentStatus === "Closed"
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* =============================
         B2C DESTINATION CONFIRM
      ============================= */}
      {showB2CConfirm && resolvedB2CDestination && (
        <Modal>
          <h2 className="text-lg font-bold mb-4 text-center">
            Confirm Transporting
          </h2>

          <p className="text-sm text-gray-300 mb-4 text-center">
            This is a B2C case. The destination will be taken from the B2C
            request.
          </p>

          <div className="rounded bg-slate-800 border border-slate-700 p-4 mb-4">
            <div className="text-xs text-gray-400 mb-1">Destination Hospital</div>
            <div className="font-bold text-white">
              {resolvedB2CDestination.hospitalName ||
                resolvedB2CDestination.name}
            </div>

            {resolvedB2CDestination.googleMapLink && (
              <a
                href={resolvedB2CDestination.googleMapLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-blue-300 underline"
              >
                Open Destination Map
              </a>
            )}

            {resolvedB2CDestination.floor && (
              <div className="mt-2 text-xs text-gray-400">
                Floor: {resolvedB2CDestination.floor}
              </div>
            )}
          </div>

          <button
            onClick={confirmB2CTransporting}
            className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded mb-2"
          >
            Confirm Transporting
          </button>

          <button
            onClick={() => setShowB2CConfirm(false)}
            className="w-full mt-2 text-sm text-gray-300 hover:text-white"
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
          <h2 className="text-lg font-bold mb-4">Transporting To?</h2>

          <button
            onClick={() => openDestinationList("hospital")}
            className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded mb-2"
          >
            Hospital
          </button>

          <button
            onClick={() => openDestinationList("clinic")}
            className="w-full bg-green-600 hover:bg-green-700 p-2 rounded"
          >
            Clinic
          </button>

          <button
            onClick={() => setShowTypePopup(false)}
            className="w-full mt-4 text-sm text-gray-300 hover:text-white"
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
          <h2 className="text-lg font-bold mb-4 text-center">
            Select Project Destination
          </h2>

          <p className="text-xs text-gray-400 mb-3 text-center">
            Showing only destinations registered on this project.
          </p>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredProjectDestinations.length === 0 ? (
              <div className="p-3 rounded bg-red-950/40 border border-red-700 text-red-300 text-sm">
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
                        ? "bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
                        : "bg-red-950/40 border-red-700 text-red-300 cursor-not-allowed"
                    }`}
                  >
                    <div className="font-semibold">{d.name}</div>

                    <div className="text-xs opacity-80">
                      {d.type}
                      {d.address ? ` • ${d.address}` : ""}
                    </div>

                    {!hasLocation && (
                      <div className="text-xs text-red-300 mt-1">
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
            className="w-full mt-4 text-sm text-gray-300 hover:text-white"
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-96 max-w-[90vw] text-white">
        {children}
      </div>
    </div>
  );
}