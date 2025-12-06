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
  query,
  where,
  getDocs,
} from "firebase/firestore";

export default function NewCasePage() {
  const [patientName, setPatientName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [level, setLevel] = useState("");
  const [locationText, setLocationText] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [unitType, setUnitType] = useState<"ambulance" | "clinic" | "roaming" | "">("");

  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState("");

  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinic, setSelectedClinic] = useState("");

  // Load Ambulances Live
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      setAmbulances(list);
    });
    return () => unsub();
  }, []);

  // Load Clinics from Firestore (destinations collection)
  useEffect(() => {
    const loadClinics = async () => {
      const q = query(collection(db, "destinations"), where("type", "==", "clinic"));
      const snap = await getDocs(q);

      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setClinics(list);
    };

    loadClinics();
  }, []);

  // Parse Lat/Lng
  function parseLatLng(input: string) {
    if (!input.includes(",")) return;
    const [la, ln] = input.split(",").map((x) => parseFloat(x.trim()));
    setLat(la);
    setLng(ln);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();

    if (!patientName || !chiefComplaint || !level) {
      alert("Please fill all required fields");
      return;
    }

    let assignedUnit = null;

    if (unitType === "ambulance") {
      assignedUnit = { type: "ambulance", id: selectedAmbulance };
    } else if (unitType === "clinic") {
      assignedUnit = { type: "clinic", id: selectedClinic };
    } else {
      assignedUnit = { type: "roaming", id: null };
    }

    const caseRef = await addDoc(collection(db, "cases"), {
      patientName,
      chiefComplaint,
      level,
      locationText,
      lat,
      lng,
      unitType,
      assignedUnit,
      status: "Received",
      createdAt: serverTimestamp(),
    });

    // Mark ambulance busy if selected
    if (unitType === "ambulance" && selectedAmbulance) {
      await updateDoc(doc(db, "ambulances", selectedAmbulance), {
        status: "busy",
        currentCase: caseRef.id,
      });
    }

    alert("Case created successfully!");
    window.location.href = "/cases";
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create New Case</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-[#1c2333] p-6 rounded-lg border border-gray-700">
        
        {/* Patient Name */}
        <div>
          <label className="font-semibold">Patient Name</label>
          <input
            className="w-full border p-2 rounded bg-[#0f1625] text-white border-gray-600"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>

        {/* Complaint */}
        <div>
          <label className="font-semibold">Chief Complaint</label>
          <input
            className="w-full border p-2 rounded bg-[#0f1625] text-white border-gray-600"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
          />
        </div>

        {/* Level */}
        <div>
          <label className="font-semibold">Level (Triage)</label>
          <select
            className="w-full border p-2 rounded bg-[#0f1625] text-white border-gray-600"
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
          <label className="font-semibold">Location</label>
          <input
            className="w-full border p-2 rounded bg-[#0f1625] text-white border-gray-600"
            placeholder="24.7136, 46.6753"
            value={locationText}
            onChange={(e) => {
              setLocationText(e.target.value);
              parseLatLng(e.target.value);
            }}
          />
        </div>

        {/* Assign Unit */}
        <div>
          <label className="font-semibold block">Assign Unit</label>

          <div className="flex items-center space-x-4 mt-1 text-white">
            <label>
              <input
                type="radio"
                name="unit"
                value="ambulance"
                checked={unitType === "ambulance"}
                onChange={() => setUnitType("ambulance")}
              />{" "}
              Ambulance
            </label>

            <label>
              <input
                type="radio"
                name="unit"
                value="clinic"
                checked={unitType === "clinic"}
                onChange={() => setUnitType("clinic")}
              />{" "}
              Clinic
            </label>

            <label>
              <input
                type="radio"
                name="unit"
                value="roaming"
                checked={unitType === "roaming"}
                onChange={() => setUnitType("roaming")}
              />{" "}
              Roaming
            </label>
          </div>
        </div>

        {/* If ambulance selected → show dropdown */}
        {unitType === "ambulance" && (
          <div>
            <label className="font-semibold">Select Ambulance</label>
            <select
              className="w-full border p-2 rounded bg-[#0f1625] text-white border-gray-600"
              value={selectedAmbulance}
              onChange={(e) => setSelectedAmbulance(e.target.value)}
            >
              <option value="">Select ambulance...</option>
              {ambulances.map((a) => (
                <option key={a.docId} value={a.docId}>
                  {a.code} — {a.status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* If clinic selected → show dropdown */}
        {unitType === "clinic" && (
          <div>
            <label className="font-semibold">Select Clinic</label>
            <select
              className="w-full border p-2 rounded bg-[#0f1625] text-white border-gray-600"
              value={selectedClinic}
              onChange={(e) => setSelectedClinic(e.target.value)}
            >
              <option value="">Select clinic...</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.address}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700"
        >
          Submit Case
        </button>
      </form>
    </div>
  );
}
