"use client";

import { useState } from "react";
import {
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =============================
   TYPES
============================= */
type CaseLocation = {
  lat: number;
  lng: number;
  address?: string;
};

type ProjectHospital = {
  id: string;
  name: string;
  type: "hospital" | "clinic";
  lat?: number | null;
  lng?: number | null;
  address?: string;
};

type Destination = {
  id: string;
  name: string;
  type: "hospital" | "clinic";
  lat: number;
  lng: number;
  address?: string;
};

type StatusButtonsProps = {
  caseId: string;
  currentStatus: string;
  caseLocation?: CaseLocation;
  projectHospitals?: ProjectHospital[];
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
   COMPONENT
============================= */
export default function StatusButtons({
  caseId,
  currentStatus,
  caseLocation,
  projectHospitals = [],
  onDestinationSelected,
}: StatusButtonsProps) {
  const [showTypePopup, setShowTypePopup] = useState(false);
  const [destinationType, setDestinationType] =
    useState<"hospital" | "clinic" | null>(null);
  const [showDestinationList, setShowDestinationList] = useState(false);

  /* =============================
     BASIC STATUS UPDATE
  ============================= */
  const updateStatus = async (newStatus: string) => {
    if (currentStatus === "Closed") return;

    // Special handling for Transporting
    if (newStatus === "Transporting") {
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
     OPEN PROJECT DESTINATION LIST
  ============================= */
  const openDestinationList = (type: "hospital" | "clinic") => {
    setDestinationType(type);
    setShowTypePopup(false);
    setShowDestinationList(true);
  };

  /* =============================
     SELECT DESTINATION
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
    };

    await updateDoc(doc(db, "cases", caseId), {
      status: "Transporting",
      destination: cleanDestination,
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
         DESTINATION TYPE POPUP
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
function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-96 max-w-[90vw] text-white">
        {children}
      </div>
    </div>
  );
}