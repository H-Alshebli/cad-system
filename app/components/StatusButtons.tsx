"use client";

import { useEffect, useState } from "react";
import {
  updateDoc,
  doc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
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
  onDestinationSelected,
}: StatusButtonsProps) {
  const [showTypePopup, setShowTypePopup] = useState(false);
  const [destinationType, setDestinationType] =
    useState<"hospital" | "clinic" | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [showDestinationList, setShowDestinationList] = useState(false);
  const [loading, setLoading] = useState(false);

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
      setShowTypePopup(true);
      return;
    }

    await updateDoc(doc(db, "cases", caseId), {
      status: newStatus,
      [`timeline.${newStatus}`]: serverTimestamp(),
    });
  };

  /* =============================
     LOAD DESTINATIONS
  ============================= */
  const loadDestinations = async (type: "hospital" | "clinic") => {
    setLoading(true);
    setDestinationType(type);

    const q = query(
      collection(db, "destinations"),
      where("type", "==", type)
    );

    const snap = await getDocs(q);
    const list: Destination[] = [];

    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        name: data.name,
        type,
        lat: data.lat,
        lng: data.lng,
        address: data.address || "",
      });
    });

    setDestinations(list);
    setShowTypePopup(false);
    setShowDestinationList(true);
    setLoading(false);
  };

  /* =============================
     SELECT DESTINATION
  ============================= */
  const selectDestination = async (destination: Destination) => {
    await updateDoc(doc(db, "cases", caseId), {
      status: "Transporting",
      destination,
      [`timeline.Transporting`]: serverTimestamp(),
    });

    onDestinationSelected?.(destination);

    setShowDestinationList(false);
    setDestinationType(null);
  };

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
            onClick={() => loadDestinations("hospital")}
            className="w-full bg-blue-600 p-2 rounded mb-2"
          >
            Hospital
          </button>

          <button
            onClick={() => loadDestinations("clinic")}
            className="w-full bg-green-600 p-2 rounded"
          >
            Clinic
          </button>

          <button
            onClick={() => setShowTypePopup(false)}
            className="w-full mt-4 text-sm text-gray-300"
          >
            Cancel
          </button>
        </Modal>
      )}

      {/* =============================
         DESTINATION LIST
      ============================= */}
      {showDestinationList && (
        <Modal>
          <h2 className="text-lg font-bold mb-4 text-center">
            Select Destination
          </h2>

          {loading && (
            <p className="text-center text-gray-400">Loading…</p>
          )}

          <div className="max-h-64 overflow-y-auto space-y-2">
            {destinations.map((d) => (
              <button
                key={d.id}
                onClick={() => selectDestination(d)}
                className="w-full text-left p-3 rounded bg-blue-600 hover:bg-blue-700"
              >
                <div className="font-semibold">{d.name}</div>
                {d.address && (
                  <div className="text-xs opacity-80">{d.address}</div>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowDestinationList(false)}
            className="w-full mt-4 text-sm text-gray-300"
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
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg w-80 text-white">
        {children}
      </div>
    </div>
  );
}
