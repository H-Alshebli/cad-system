"use client";

import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  getDocs,
  updateDoc,
  collection,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Map from "@/app/components/Map";

interface CaseData {
  patientName: string;
  chiefComplaint: string;
  level: string;
  status: string;
  locationText?: string;
  lat?: number;
  lng?: number;
  ambulanceId?: string;
}

export default function CaseDetails({ params }: { params: { id: string } }) {
  const caseId = params.id;

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------------------
  // REAL-TIME FIREBASE LISTENER
  // ---------------------------
  useEffect(() => {
    const ref = doc(db, "cases", caseId);

    // Live updates for the case
    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (snapshot.exists()) {
        setCaseData(snapshot.data() as CaseData);
      }
    });

    // Load ambulance list once
    const loadAmbulances = async () => {
      const ambSnap = await getDocs(collection(db, "ambulances"));
      const list: any[] = [];
      ambSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setAmbulances(list);
    };

    loadAmbulances();
    setLoading(false);

    return () => unsubscribe();
  }, [caseId]);

  // ---------------------------
  // UPDATE CASE STATUS
  // ---------------------------
  const updateStatus = async (newStatus: string) => {
    await updateDoc(doc(db, "cases", caseId), {
      status: newStatus,
    });
  };

  // ---------------------------
  // ASSIGN / REASSIGN AMBULANCE
  // ---------------------------
  const handleAssignAmbulance = async (newAmbulanceId: string) => {
    try {
      const caseRef = doc(db, "cases", caseId);
      const caseSnap = await getDoc(caseRef);
      if (!caseSnap.exists()) return;

      const caseInfo = caseSnap.data();
      const oldAmbulanceId = caseInfo.ambulanceId ?? null;

      // Update CASE with the new ambulance
      await updateDoc(caseRef, { ambulanceId: newAmbulanceId });

      // Mark NEW ambulance as busy
      if (newAmbulanceId) {
        await updateDoc(doc(db, "ambulances", newAmbulanceId), {
          status: "busy",
        });
      }

      // Mark PREVIOUS ambulance available
      if (oldAmbulanceId && oldAmbulanceId !== newAmbulanceId) {
        await updateDoc(doc(db, "ambulances", oldAmbulanceId), {
          status: "available",
        });
      }
    } catch (err) {
      console.error("Ambulance assignment error:", err);
    }
  };

  // ---------------------------
  // Loading / Not Found
  // ---------------------------
  if (loading || !caseData) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Case Details</h1>

      {/* Case Info */}
      <div className="bg-white border p-5 rounded-lg shadow-sm">
        <p><strong>Patient:</strong> {caseData.patientName}</p>
        <p><strong>Complaint:</strong> {caseData.chiefComplaint}</p>
        <p><strong>Level:</strong> {caseData.level}</p>
        <p><strong>Status:</strong> {caseData.status}</p>
        <p><strong>Location:</strong> {caseData.locationText}</p>
        <p><strong>Ambulance:</strong> {caseData.ambulanceId || "None assigned"}</p>
      </div>

      {/* STATUS BUTTONS */}
      <h2 className="text-lg font-bold mt-6 mb-2">Update Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg">
        {["Received", "Assigned", "EnRoute", "OnScene", "Transporting", "Hospital", "Closed"]
          .map((st) => (
            <button
              key={st}
              onClick={() => updateStatus(st)}
              className={`p-3 rounded text-white font-semibold ${
                caseData.status === st ? "bg-green-600" : "bg-blue-600"
              }`}
            >
              {st}
            </button>
        ))}
      </div>

      {/* ASSIGN AMBULANCE */}
      <div className="mt-10 p-4 border rounded-lg bg-white shadow-sm">
        <h2 className="text-xl font-bold mb-3">Assign Ambulance</h2>

        <p>
          <strong>Current:</strong>{" "}
          {caseData.ambulanceId || "None"}
        </p>

        <select
          className="mt-3 p-2 border rounded w-full"
          onChange={(e) => handleAssignAmbulance(e.target.value)}
          value={caseData.ambulanceId || ""}
        >
          <option value="">Select Ambulance</option>

          {ambulances.map((amb) => (
            <option key={amb.id} value={amb.id}>
              {amb.code} — {amb.status} — {amb.location}
            </option>
          ))}
        </select>
      </div>

      {/* MAP */}
      {caseData.lat && caseData.lng && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-3">Location Map</h2>
          <Map
            latitude={Number(caseData.lat)}
            longitude={Number(caseData.lng)}
            name={caseData.locationText || "Location"}
          />
        </div>
      )}
    </div>
  );
}
