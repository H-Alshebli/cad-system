"use client";

import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import StatusButtons from "@/app/components/StatusButtons";
import Map from "@/app/components/Map";
import CaseTimeline from "@/app/components/CaseTimeline";

export default function CaseDetailsPage({ params }: { params: { id: string } }) {
  const caseId = params.id;

  const [caseData, setCaseData] = useState<any>(null);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------------------------
  // LIVE LISTENER FOR THIS CASE
  // --------------------------------------------------------------------
  useEffect(() => {
    const ref = doc(db, "cases", caseId);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setCaseData({ id: snap.id, ...snap.data() });
    });

    return () => unsub();
  }, [caseId]);

  // --------------------------------------------------------------------
  // LOAD AMBULANCES
  // --------------------------------------------------------------------
  useEffect(() => {
    const loadAmbulances = async () => {
      const ambSnap = await getDocs(collection(db, "ambulances"));
      const list: any[] = [];
      ambSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setAmbulances(list);
      setLoading(false);
    };

    loadAmbulances();
  }, []);

  if (loading || !caseData) return <p className="p-6">Loading...</p>;

  // --------------------------------------------------------------------
  // UPDATE STATUS + TIMELINE
  // --------------------------------------------------------------------
  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const caseRef = doc(db, "cases", caseId);
      const timestamp = new Date().toISOString();

      await updateDoc(caseRef, {
        status: newStatus,
        [`timeline.${newStatus}`]: timestamp,
      });

      setCaseData((prev: any) => ({
        ...prev,
        status: newStatus,
        timeline: {
          ...prev.timeline,
          [newStatus]: timestamp,
        },
      }));
    } catch (err) {
      console.error("Error updating:", err);
    }
  };

  // --------------------------------------------------------------------
  // ASSIGN AMBULANCE
  // --------------------------------------------------------------------
  const handleAssignAmbulance = async (newAmbId: string) => {
    try {
      const caseRef = doc(db, "cases", caseId);
      const caseSnap = await getDoc(caseRef);
      if (!caseSnap.exists()) return;

      const oldAmbId = caseSnap.data().ambulanceId || null;

      await updateDoc(caseRef, { ambulanceId: newAmbId });

      if (newAmbId) {
        await updateDoc(doc(db, "ambulances", newAmbId), { status: "busy" });
      }

      if (oldAmbId && oldAmbId !== newAmbId) {
        await updateDoc(doc(db, "ambulances", oldAmbId), {
          status: "available",
        });
      }

      alert("Ambulance updated!");
    } catch (err) {
      console.error(err);
      alert("Error assigning ambulance");
    }
  };

  // --------------------------------------------------------------------
  // SAVE EDITS
  // --------------------------------------------------------------------
  const saveEdits = async () => {
    try {
      await updateDoc(doc(db, "cases", caseId), {
        chiefComplaint: caseData.chiefComplaint,
        level: Number(caseData.level),
        paramedicNote: caseData.paramedicNote || "",
      });

      alert("Case updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Error saving changes.");
    }
  };

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Case Details</h1>

      {/* CASE INFO */}
      <div className="bg-white border p-6 rounded-lg shadow mb-6">
        <p><strong>Patient:</strong> {caseData.patientName}</p>
        <p><strong>Complaint:</strong> {caseData.chiefComplaint}</p>
        <p><strong>Level:</strong> {caseData.level}</p>
        <p><strong>Status:</strong> {caseData.status}</p>
        <p><strong>Location:</strong> {caseData.locationText}</p>
        <p><strong>Ambulance:</strong> {caseData.ambulanceId || "None"}</p>
      </div>

      {/* STATUS BUTTONS + TIMELINE UPDATE */}
      <h2 className="text-xl font-semibold mb-2">Update Status</h2>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
        {["Received", "Assigned", "EnRoute", "OnScene", "Transporting", "Hospital", "Closed"].map(
          (s) => (
            <button
              key={s}
              onClick={() => handleStatusUpdate(s)}
              className={`p-2 rounded text-white ${
                caseData.status === s ? "bg-green-600" : "bg-blue-600"
              }`}
            >
              {s}
            </button>
          )
        )}
      </div>

      <CaseTimeline timeline={caseData.timeline || {}} />

      {/* ASSIGN AMBULANCE */}
      <div className="mt-10 bg-white p-6 rounded-lg shadow max-w-xl">
        <h2 className="text-xl font-bold mb-2">Assign Ambulance</h2>
        <p className="text-sm text-gray-600 mb-2">
          Current: {caseData.ambulanceId || "None"}
        </p>

        <select
          className="border p-2 rounded w-full"
          value={caseData.ambulanceId || ""}
          onChange={(e) => handleAssignAmbulance(e.target.value)}
        >
          <option value="">-- Select Ambulance --</option>
          {ambulances.map((amb) => (
            <option key={amb.id} value={amb.id}>
              {amb.code} — {amb.status} — {amb.location}
            </option>
          ))}
        </select>
      </div>

      {/* EDIT CASE */}
      <div className="mt-10 bg-white p-6 rounded-lg shadow max-w-xl">
        <h2 className="text-xl font-bold mb-4">Edit Case</h2>

        <label className="block font-semibold mb-1">Complaint</label>
        <input
          type="text"
          className="border p-2 rounded w-full mb-4"
          value={caseData.chiefComplaint}
          onChange={(e) =>
            setCaseData((prev: any) => ({
              ...prev,
              chiefComplaint: e.target.value,
            }))
          }
        />

        <label className="block font-semibold mb-1">Level (Triage)</label>
        <select
          value={caseData.level}
          className="border p-2 rounded w-full mb-4"
          onChange={(e) =>
            setCaseData((prev: any) => ({
              ...prev,
              level: Number(e.target.value),
            }))
          }
        >
          <option value="1">Level 1 - Critical</option>
          <option value="2">Level 2 - Emergency</option>
          <option value="3">Level 3 - Urgent</option>
          <option value="4">Level 4 - Non-Urgent</option>
        </select>

        <label className="block font-semibold mb-1">Paramedic Note</label>
        <textarea
          className="border p-2 rounded w-full h-28 mb-4"
          value={caseData.paramedicNote || ""}
          onChange={(e) =>
            setCaseData((prev: any) => ({
              ...prev,
              paramedicNote: e.target.value,
            }))
          }
        />

        <button
          onClick={saveEdits}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold p-3 rounded w-full"
        >
          Save Changes
        </button>
      </div>

      {/* MAP */}
      {caseData.lat && caseData.lng && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-2">Location Map</h2>
          <Map
            latitude={Number(caseData.lat)}
            longitude={Number(caseData.lng)}
            name={caseData.locationText}
          />
        </div>
      )}
    </div>
  );
}
