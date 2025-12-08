"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  query,
  where,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

/* ---------------------------------------------------------
   TYPE DEFINITIONS
----------------------------------------------------------*/
interface IjrnyCase {
  id: string;
  IjrnyId: string;
  chiefComplaint: string;
  level: string;
  lat: number;
  lng: number;
  locationText: string;
  patientName: string;
  status: "pending" | "used";
  createdAt: any;
}

export default function NewCasePage() {
  /* ---------------------------------------------------------
     FORM STATE
  ----------------------------------------------------------*/
  const [ijrnyCode, setIjrnyCode] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [level, setLevel] = useState("");
  const [locationText, setLocationText] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [unitType, setUnitType] =
    useState<"ambulance" | "clinic" | "roaming" | "">("");

  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");

  const [ijrnyCases, setIjrnyCases] = useState<IjrnyCase[]>([]);
  const [completedCases, setCompletedCases] = useState<IjrnyCase[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  /* ---------------------------------------------------------
     GENERATE LAZEM CODE
----------------------------------------------------------*/
  function generateLazemCode() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const random = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    return `CASE-${y}${m}${d}-${random}`;
  }

  /* ---------------------------------------------------------
     LOAD iJRNY PENDING CASES
----------------------------------------------------------*/
  useEffect(() => {
    const q = query(
      collection(db, "ijrny_cases"),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setIjrnyCases(arr as IjrnyCase[]);
    });

    return () => unsub();
  }, []);

  /* ---------------------------------------------------------
     LOAD COMPLETED iJRNY CASES
----------------------------------------------------------*/
  useEffect(() => {
    const q = query(
      collection(db, "ijrny_cases"),
      where("status", "==", "used")
    );

    const unsub = onSnapshot(q, (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setCompletedCases(arr as IjrnyCase[]);
    });

    return () => unsub();
  }, []);

  /* ---------------------------------------------------------
     LOAD AMBULANCES
----------------------------------------------------------*/
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAmbulances(list);
    });
    return () => unsub();
  }, []);

  /* ---------------------------------------------------------
     LOAD CLINICS
----------------------------------------------------------*/
  useEffect(() => {
    const loadClinics = async () => {
      const q = query(
        collection(db, "destinations"),
        where("type", "==", "clinic")
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClinics(list);
    };
    loadClinics();
  }, []);

  /* ---------------------------------------------------------
     AUTO-FILL FROM iJRNY
----------------------------------------------------------*/
  const loadIjrnyCase = async (c: IjrnyCase) => {
    setIjrnyCode(c.IjrnyId);
    setChiefComplaint(c.chiefComplaint || "");
    setLevel(c.level || "");
    setLocationText(c.locationText || "");
    setLat(c.lat);
    setLng(c.lng);

    await updateDoc(doc(db, "ijrny_cases", c.id), {
      status: "used",
    });
  };

  /* ---------------------------------------------------------
     SUBMIT FORM
----------------------------------------------------------*/
  const submitCase = async () => {
    if (!chiefComplaint || !level || lat === null || lng === null) {
      alert("Please fill all required fields.");
      return;
    }

    const lazemCode = generateLazemCode();

    let assignedUnit: any = null;

    if (unitType === "ambulance") {
      assignedUnit = { type: "ambulance", id: selectedUnit };
    } else if (unitType === "clinic") {
      assignedUnit = { type: "clinic", id: selectedUnit };
    } else if (unitType === "roaming") {
      assignedUnit = { type: "roaming", id: null };
    }

    await addDoc(collection(db, "cases"), {
      lazemCode,
      ijrny: ijrnyCode,
      chiefComplaint,
      level,
      locationText,
      lat,
      lng,
      unitType,
      assignedUnit,
      status: "Received",
      createdAt: serverTimestamp(),
      timeline: {
        Received: new Date().toISOString(),
      },
    });

    alert("Case submitted successfully!");

    setIjrnyCode("");
    setChiefComplaint("");
    setLevel("");
    setLocationText("");
    setLat(null);
    setLng(null);
    setUnitType("");
    setSelectedUnit("");
  };

  /* =========================================================
     UI
  =========================================================*/
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">

      {/* LEFT PANEL — BLUE IN DARK / WHITE IN LIGHT */}
      <div className="bg-white dark:bg-[#1c2333] p-4 rounded-lg shadow border border-gray-300 dark:border-gray-700">

        <h2 className="text-xl font-bold mb-4 dark:text-white">
          iJrny Incoming Cases
        </h2>

        {ijrnyCases.length === 0 && (
          <p className="text-gray-600 dark:text-gray-300">No incoming cases.</p>
        )}

        {ijrnyCases.map((c) => (
          <div
            key={c.id}
            className="
              bg-white text-black 
              dark:bg-[#0f1625] dark:text-white 
              border border-gray-300 dark:border-gray-700 
              p-3 rounded mb-3
            "
          >
            <p className="font-bold">{c.IjrnyId}</p>
            <p className="opacity-80">
              {c.chiefComplaint} — Level {c.level}
            </p>
            <p className="opacity-60">Location: {c.locationText}</p>
            <p className="opacity-60">Patient: {c.patientName}</p>

            <button
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 py-2 rounded text-white font-semibold"
              onClick={() => loadIjrnyCase(c)}
            >
              Load Into Form
            </button>
          </div>
        ))}

        {/* Show Completed */}
        <button
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? "Hide Completed Cases" : "Show Completed Cases"}
        </button>

        {showCompleted && (
          <div className="mt-3">
            {completedCases.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-[#0f1625] p-3 rounded mb-2 border border-gray-300 dark:border-gray-700"
              >
                <p className="font-bold">{c.IjrnyId}</p>
                <p className="opacity-70">{c.chiefComplaint}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT PANEL — FORM */}
      <div className="bg-white dark:bg-[#1c2333] p-4 rounded-lg shadow border border-gray-300 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 dark:text-white">New Case Form</h2>

        <div className="flex flex-col gap-3">

          <input className="bg-white dark:bg-[#0F172A] p-2 rounded" placeholder="iJrny Case Code" value={ijrnyCode} readOnly />

          <input className="bg-white dark:bg-[#0F172A] p-2 rounded" placeholder="Chief Complaint" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />

          <input className="bg-white dark:bg-[#0F172A] p-2 rounded" placeholder="Triage Level" value={level} onChange={(e) => setLevel(e.target.value)} />

          <input className="bg-white dark:bg-[#0F172A] p-2 rounded" placeholder="Location Text" value={locationText} onChange={(e) => setLocationText(e.target.value)} />

          <input className="bg-white dark:bg-[#0F172A] p-2 rounded" placeholder="Latitude" value={lat ?? ""} onChange={(e) => setLat(parseFloat(e.target.value))} />

          <input className="bg-white dark:bg-[#0F172A] p-2 rounded" placeholder="Longitude" value={lng ?? ""} onChange={(e) => setLng(parseFloat(e.target.value))} />

          {/* Unit selection */}
          <label className="font-semibold dark:text-white mt-2">Assign Unit</label>

          <div className="flex gap-4 dark:text-white">
            <label>
              <input type="radio" checked={unitType === "ambulance"} onChange={() => { setUnitType("ambulance"); setSelectedUnit(""); }} /> Ambulance
            </label>

            <label>
              <input type="radio" checked={unitType === "clinic"} onChange={() => { setUnitType("clinic"); setSelectedUnit(""); }} /> Clinic
            </label>

            <label>
              <input type="radio" checked={unitType === "roaming"} onChange={() => { setUnitType("roaming"); setSelectedUnit(""); }} /> Roaming
            </label>
          </div>

          {/* Ambulance Dropdown */}
          {unitType === "ambulance" && (
            <select
              className="bg-white dark:bg-[#2a2a2a] p-2 rounded"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              <option value="">Select Ambulance...</option>
              {ambulances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.status}
                </option>
              ))}
            </select>
          )}

          {/* Clinic Dropdown */}
          {unitType === "clinic" && (
            <select
              className="bg-white dark:bg-[#2a2a2a] p-2 rounded"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              <option value="">Select Clinic...</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.address}
                </option>
              ))}
            </select>
          )}

          {/* Submit */}
          <button
            onClick={submitCase}
            className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-white font-semibold mt-3"
          >
            Submit Case
          </button>

        </div>
      </div>
    </div>
  );
}
