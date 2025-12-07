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
  const [Ijrny, setIjrny] = useState(""); // MANUAL ENTRY
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [level, setLevel] = useState("");
  const [locationText, setLocationText] = useState("");
  const [lat, setLat] = useState<number | null>(24.7136);
  const [lng, setLng] = useState<number | null>(46.6753);

  const [unitType, setUnitType] = useState<
    "ambulance" | "clinic" | "roaming" | ""
  >("");

  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState("");

  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinic, setSelectedClinic] = useState("");

  /* ---------------------------------------------------------
     LOAD AMBULANCES LIVE
  ----------------------------------------------------------*/
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      setAmbulances(list);
    });
    return () => unsub();
  }, []);

  /* ---------------------------------------------------------
     LOAD CLINICS
  ----------------------------------------------------------*/
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

  /* ---------------------------------------------------------
     AUTO-GENERATE LAZEM CASE CODE
     Example: CASE-20251207-119
  ----------------------------------------------------------*/
  function generateCaseCode() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const random = String(Math.floor(Math.random() * 999)).padStart(3, "0");

    return `CASE-${y}${m}${d}-${random}`;
  }

  /* ---------------------------------------------------------
     PARSE LAT/LNG
  ----------------------------------------------------------*/
  function parseLatLng(input: string) {
    if (!input.includes(",")) return;
    const [la, ln] = input.split(",").map((x) => parseFloat(x.trim()));
    setLat(la);
    setLng(ln);
  }

  /* ---------------------------------------------------------
     SUBMIT CASE
  ----------------------------------------------------------*/
  async function handleSubmit(e: any) {
    e.preventDefault();

    if (!Ijrny || !chiefComplaint || !level) {
      alert("Please fill all required fields");
      return;
    }

    const now = new Date().toISOString();

    const caseCode = generateCaseCode();

    let assignedUnit = null;

    if (unitType === "ambulance") {
      assignedUnit = { type: "ambulance", id: selectedAmbulance };
    } else if (unitType === "clinic") {
      assignedUnit = { type: "clinic", id: selectedClinic };
    } else {
      assignedUnit = { type: "roaming", id: null };
    }

    const ambulanceCode =
      unitType === "ambulance"
        ? ambulances.find((a) => a.docId === selectedAmbulance)?.code || null
        : null;

    const clinicName =
      unitType === "clinic"
        ? clinics.find((c) => c.id === selectedClinic)?.name || null
        : null;

    /* ---------------------------------------------------------
       SAVE NEW CASE WITH TIMELINE (Received + Assigned)
    ----------------------------------------------------------*/
    const caseRef = await addDoc(collection(db, "cases"), {
      caseCode,
      Ijrny,
      chiefComplaint,
      level,
      locationText,
      lat,
      lng,

      unitType,
      assignedUnit,
      ambulanceCode,
      clinicId: selectedClinic,
      clinicName,

      status: "Assigned", // Start as Assigned
      timeline: {
        Received: now,
        Assigned: now,
      },

      createdAt: serverTimestamp(),
    });

    /* ---------------------------------------------------------
       SET AMBULANCE BUSY
    ----------------------------------------------------------*/
    if (unitType === "ambulance" && selectedAmbulance) {
      await updateDoc(doc(db, "ambulances", selectedAmbulance), {
        status: "busy",
        currentCase: caseRef.id,
      });
    }

    alert("Case created successfully!");

    window.location.href = "/cases";
  }

  /* ---------------------------------------------------------
     UI
  ----------------------------------------------------------*/
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create New Case</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-[#1c2333] p-6 rounded-lg border border-gray-700"
      >
        {/* IJRNY CODE */}
        <div>
          <label className="font-semibold">Ijrny Case Code</label>
          <input
            className="w-full border p-2 rounded bg-[#0f1625] text-white border-gray-600"
            value={Ijrny}
            onChange={(e) => setIjrny(e.target.value)}
            placeholder="Enter IJRNY code"
          />
        </div>

        {/* COMPLAINT */}
        <div>
          <label className="font-semibold">Chief Complaint</label>
          <input
            className="w-full border p-2 rounded bg-[#0f1625] text-white border-gray-600"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
          />
        </div>

        {/* LEVEL */}
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

        {/* LOCATION */}
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

        {/* ASSIGN UNIT */}
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

        {/* AMBULANCE DROPDOWN */}
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

        {/* CLINIC DROPDOWN */}
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

        {/* SUBMIT BUTTON */}
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
