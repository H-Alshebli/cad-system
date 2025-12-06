"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

export default function NewCasePage() {
  const [patientName, setPatientName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [level, setLevel] = useState("");
  const [locationText, setLocationText] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState("");

  // Load ambulances live
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list = snap.docs.map((d) => ({
        docId: d.id,
        ...d.data(),
      }));
      setAmbulances(list);
    });

    return () => unsub();
  }, []);

  // Parse Lat/Lng
  function parseLatLng(input: string) {
    if (!input.includes(",")) return;
    const [la, ln] = input.split(",").map((x) => parseFloat(x.trim()));
    setLat(la);
    setLng(ln);
  }

  // Submit case
  async function handleSubmit(e: any) {
    e.preventDefault();

    if (!patientName || !chiefComplaint || !level) {
      alert("Please fill all required fields");
      return;
    }

    const amb = ambulances.find((a) => a.docId === selectedAmbulance);

    const caseRef = await addDoc(collection(db, "cases"), {
      patientName,
      chiefComplaint,
      level,
      locationText,
      lat,
      lng,
      status: "Received",
      createdAt: serverTimestamp(),

      ambulanceId: selectedAmbulance,
      ambulanceCode: amb?.code || null,
    });

    if (selectedAmbulance) {
      await updateDoc(doc(db, "ambulances", selectedAmbulance), {
        status: "busy",
        currentCase: caseRef.id,
      });
    }

    setPatientName("");
    setChiefComplaint("");
    setLevel("");
    setLocationText("");
    setLat(null);
    setLng(null);
    setSelectedAmbulance("");

    alert("Case created successfully!");
    window.location.href = "/cases";
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">

      <h1 className="text-3xl font-bold mb-6">Create New Case</h1>

      <form
        onSubmit={handleSubmit}
        className="
          space-y-4 
          bg-white dark:bg-gray-800 
          p-6 rounded-lg shadow-lg
          border dark:border-gray-700
        "
      >
        {/* Patient Name */}
        <div>
          <label className="font-semibold text-gray-800 dark:text-gray-200">
            Patient Name
          </label>
          <input
            className="
              w-full border p-2 rounded 
              bg-white dark:bg-gray-700 
              text-black dark:text-white 
              border-gray-300 dark:border-gray-600
            "
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>

        {/* Complaint */}
        <div>
          <label className="font-semibold text-gray-800 dark:text-gray-200">
            Chief Complaint
          </label>
          <input
            className="
              w-full border p-2 rounded
              bg-white dark:bg-gray-700 
              text-black dark:text-white 
              border-gray-300 dark:border-gray-600
            "
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
          />
        </div>

        {/* Level */}
        <div>
          <label className="font-semibold text-gray-800 dark:text-gray-200">
            Level (Triage)
          </label>
          <select
            className="
              w-full border p-2 rounded
              bg-white dark:bg-gray-700 
              text-black dark:text-white 
              border-gray-300 dark:border-gray-600
            "
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">Select Level</option>
            <option value="1">Level 1 - Critical</option>
            <option value="2">Level 2 - Emergency</option>
            <option value="3">Level 3 - Urgent</option>
            <option value="4">Level 4 - Non-Urgent</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="font-semibold text-gray-800 dark:text-gray-200">
            Location
          </label>
          <input
            className="
              w-full border p-2 rounded
              bg-white dark:bg-gray-700 
              text-black dark:text-white 
              border-gray-300 dark:border-gray-600
            "
            placeholder="24.7136, 46.6753"
            value={locationText}
            onChange={(e) => {
              setLocationText(e.target.value);
              parseLatLng(e.target.value);
            }}
          />
        </div>

        {/* Ambulance */}
        <div>
          <label className="font-semibold text-gray-800 dark:text-gray-200">
            Assign Ambulance
          </label>
          <select
            className="
              w-full border p-2 rounded
              bg-white dark:bg-gray-700 
              text-black dark:text-white 
              border-gray-300 dark:border-gray-600
            "
            value={selectedAmbulance}
            onChange={(e) => setSelectedAmbulance(e.target.value)}
          >
            <option value="">Select ambulance…</option>
            {ambulances.map((amb) => (
              <option key={amb.docId} value={amb.docId}>
                {amb.code} — {amb.location} — {amb.status}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="
            bg-blue-600 hover:bg-blue-700 
            text-white px-4 py-2 rounded 
            w-full font-semibold
          "
        >
          Submit Case
        </button>
      </form>
    </div>
  );
}
