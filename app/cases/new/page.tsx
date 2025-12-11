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
import dynamic from "next/dynamic";

// Load Map ONLY in client (fixes Vercel SSR window issue)
const Map = dynamic(() => import("@/app/components/Map"), {
  ssr: false,
});

/* ---------------------------------------------------------
   TYPES
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

/* ---------------------------------------------------------
   PAGE
----------------------------------------------------------*/
export default function NewCasePage() {
  /* FORM STATE */
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
  const [roaming, setRoaming] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [unitList, setUnitList] = useState<any[]>([]);

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
     LOAD iJRNY CASES
  ----------------------------------------------------------*/
  useEffect(() => {
    const qPending = query(
      collection(db, "ijrny_cases"),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(qPending, (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setIjrnyCases(arr as IjrnyCase[]);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const qUsed = query(
      collection(db, "ijrny_cases"),
      where("status", "==", "used")
    );

    const unsub = onSnapshot(qUsed, (snap) => {
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setCompletedCases(arr as IjrnyCase[]);
    });

    return () => unsub();
  }, []);

  /* ---------------------------------------------------------
     LOAD AMBULANCES / CLINICS / ROAMING
  ----------------------------------------------------------*/
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambulances"), (snap) => {
      setAmbulances(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadClinics = async () => {
      const qClinics = query(
        collection(db, "destinations"),
        where("type", "==", "clinic")
      );
      const snap = await getDocs(qClinics);
      setClinics(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    loadClinics();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "Roaming"), (snap) => {
      setRoaming(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  /* ---------------------------------------------------------
     LOAD iJRNY CASE INTO FORM
  ----------------------------------------------------------*/
  const loadIjrnyCase = async (c: IjrnyCase) => {
    setIjrnyCode(c.IjrnyId);
    setChiefComplaint(c.chiefComplaint || "");
    setLevel(c.level || "");
    setLocationText(c.locationText || "");
    setLat(c.lat);
    setLng(c.lng);

    setUnitType("");
    setSelectedUnitId("");
    setUnitList([]);

    await updateDoc(doc(db, "ijrny_cases", c.id), { status: "used" });
  };

  /* ---------------------------------------------------------
     DISTANCE CALCULATION
  ----------------------------------------------------------*/
  function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371e3;
    const toRad = (v: number) => (v * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* ---------------------------------------------------------
     BUILD NEAREST UNIT LIST
  ----------------------------------------------------------*/
  useEffect(() => {
    if (lat === null || lng === null || !unitType) {
      setUnitList([]);
      return;
    }

    let source: any[] = [];
    if (unitType === "ambulance") source = ambulances;
    if (unitType === "clinic") source = clinics;
    if (unitType === "roaming") source = roaming;

    const list = source
      .filter((u) => typeof u.lat === "number" && typeof u.lng === "number")
      .map((u) => ({ ...u, dist: distance(lat, lng, u.lat, u.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .map((u, idx) => ({ ...u, isNearest: idx === 0 }));

    setUnitList(list);
  }, [lat, lng, unitType, ambulances, clinics, roaming]);

  function handleUnitTypeChange(type: "ambulance" | "clinic" | "roaming") {
    setUnitType(type);
    setSelectedUnitId("");
  }

  /* ---------------------------------------------------------
     SUBMIT CASE
  ----------------------------------------------------------*/
  const submitCase = async () => {
    if (!chiefComplaint || !level || lat === null || lng === null) {
      alert("Please fill all required fields.");
      return;
    }

    if (!unitType) {
      alert("Please select unit type.");
      return;
    }

    if (!selectedUnitId) {
      alert("Please select a unit.");
      return;
    }

    const lazemCode = generateLazemCode();
    const now = new Date().toISOString();

    let assignedUnit: any = null;
    let ambulanceCode: string | null = null;
    let clinicId: string | null = null;
    let roamingCode: string | null = null; // ✅ NEW

    if (unitType === "ambulance") {
      assignedUnit = { type: "ambulance", id: selectedUnitId };
      ambulanceCode =
        ambulances.find((a) => a.id === selectedUnitId)?.code || null;
    }

    if (unitType === "clinic") {
      assignedUnit = { type: "clinic", id: selectedUnitId };
      clinicId = selectedUnitId;
    }

    if (unitType === "roaming") {
      assignedUnit = { type: "roaming", id: selectedUnitId };
      // Roaming document has "code": "BIG ROMEO TANGO 02"
      roamingCode =
        roaming.find((r) => r.id === selectedUnitId)?.code || null;
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
      ambulanceCode,
      clinicId,
      roaming: roamingCode, // ✅ IMPORTANT
      status: "Assigned",
      createdAt: serverTimestamp(),
      timeline: {
        Received: now,
        Assigned: now,
      },
    });

    alert("Case submitted successfully!");

    // Reset form
    setIjrnyCode("");
    setChiefComplaint("");
    setLevel("");
    setLocationText("");
    setLat(null);
    setLng(null);
    setUnitType("");
    setSelectedUnitId("");
    setUnitList([]);
  };

  /* ---------------------------------------------------------
     UI
  ----------------------------------------------------------*/
  return (
    <div className="p-4 space-y-4">
      {/* TOP ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT PANEL */}
        <div className="bg-[#1c2333] p-4 rounded-lg shadow border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-white">
            iJrny Incoming Cases
          </h2>

          {ijrnyCases.length === 0 && (
            <p className="text-gray-300 text-sm">No incoming cases.</p>
          )}

          {ijrnyCases.map((c) => (
            <div
              key={c.id}
              className="bg-[#0f1625] text-white border border-gray-700 p-3 rounded mb-3 cursor-pointer hover:border-blue-500"
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

          <button
            className="mt-4 text-sm text-blue-400 hover:underline"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? "Hide Completed Cases" : "Show Completed Cases"}
          </button>

          {showCompleted && (
            <div className="mt-3">
              {completedCases.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#0f1625] text-white p-3 rounded mb-2 border border-gray-700"
                >
                  <p className="font-bold">{c.IjrnyId}</p>
                  <p className="opacity-70">{c.chiefComplaint}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT PANEL — FORM */}
        <div className="bg-[#1c2333] p-4 rounded-lg shadow border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-white">New Case Form</h2>

          <div className="flex flex-col gap-3">
            <input
              className="bg-[#0F172A] text-white p-2 rounded"
              placeholder="iJrny Case Code"
              value={ijrnyCode}
              onChange={(e) => setIjrnyCode(e.target.value)}
            />

            <input
              className="bg-[#0F172A] text-white p-2 rounded"
              placeholder="Chief Complaint"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />

            <input
              className="bg-[#0F172A] text-white p-2 rounded"
              placeholder="Triage Level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />

            <input
              className="bg-[#0F172A] text-white p-2 rounded"
              placeholder="Location Text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />

           <input
  className="bg-[#0F172A] text-white p-2 rounded"
  placeholder="Latitude"
  value={lat ?? ""}
  onChange={(e) => {
    const v = e.target.value;
    setLat(v === "" ? null : Number(v));
  }}
  type="text"
  inputMode="decimal"
  pattern="[0-9]+([.][0-9]+)?"
/>

<input
  className="bg-[#0F172A] text-white p-2 rounded"
  placeholder="Longitude"
  value={lng ?? ""}
  onChange={(e) => {
    const v = e.target.value;
    setLng(v === "" ? null : Number(v));
  }}
  type="text"
  inputMode="decimal"
  pattern="[0-9]+([.][0-9]+)?"
/>



            {/* UNIT TYPE */}
            <label className="font-semibold text-white mt-2">
              Assign Unit
            </label>

            <div className="flex gap-4 text-white">
              <label>
                <input
                  type="radio"
                  checked={unitType === "ambulance"}
                  onChange={() => handleUnitTypeChange("ambulance")}
                />{" "}
                Ambulance
              </label>

              <label>
                <input
                  type="radio"
                  checked={unitType === "clinic"}
                  onChange={() => handleUnitTypeChange("clinic")}
                />{" "}
                Clinic
              </label>

              <label>
                <input
                  type="radio"
                  checked={unitType === "roaming"}
                  onChange={() => handleUnitTypeChange("roaming")}
                />{" "}
                Roaming
              </label>
            </div>

            {/* UNIT LIST */}
            {unitType && unitList.length > 0 && (
              <div className="bg-[#0f1625] p-4 rounded border border-gray-700 mt-2">
                <h3 className="text-white font-semibold mb-3">
                  Select {unitType} (sorted by nearest)
                </h3>

                {unitList.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUnitId(u.id as string)}
                    className={`p-3 mb-2 rounded cursor-pointer border ${
                      selectedUnitId === u.id
                        ? "border-blue-500 bg-[#162036]"
                        : "border-gray-600"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-white font-semibold">
                        {u.code || u.name}
                      </span>
                      {u.isNearest && (
                        <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                          NEAREST
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {(u.dist / 1000).toFixed(2)} km away
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUBMIT */}
            <button
              onClick={submitCase}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded text-white font-semibold mt-4"
            >
              Submit Case
            </button>
          </div>
        </div>
      </div>

      {/* MAP SECTION */}
      <div className="w-full h-[450px] rounded-lg overflow-hidden border border-gray-700">
        <Map
          caseLat={lat ?? undefined}
          caseLng={lng ?? undefined}
          caseName={locationText}
          ambulances={ambulances}
          clinics={clinics}
          roaming={roaming}
        />
      </div>
    </div>
  );
}
