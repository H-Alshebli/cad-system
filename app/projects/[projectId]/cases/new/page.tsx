"use client";

import { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

/* ---------------------------
   Client-only map
----------------------------*/
const Map = dynamic(() => import("@/app/components/Map"), { ssr: false });

/* ---------------------------
   UI Helpers
----------------------------*/
const FieldLabel = ({ text }: { text: string }) => (
  <label className="text-sm text-gray-300 font-medium mb-1 block">
    {text}
  </label>
);

const inputClass =
  "w-full h-11 px-3 rounded bg-[#0f1625] text-white border border-gray-700 focus:outline-none focus:border-blue-500";

/* ---------------------------
   Google Maps Parser
----------------------------*/
function extractLatLngFromGoogleMaps(url: string) {
  const patterns = [
    /q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
    /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
  ];

  for (const p of patterns) {
    const match = url.match(p);
    if (match) {
      return {
        lat: Number(match[1]),
        lng: Number(match[2]),
      };
    }
  }
  return null;
}

/* =========================================================
   PAGE
========================================================= */
export default function NewProjectCasePage({
  params,
}: {
  params: { projectId: string };
}) {
  const router = useRouter();

  /* ---------------------------
     FORM STATE
  ----------------------------*/
  const [callerName, setCallerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [triageLevel, setTriageLevel] = useState("");
  const [patientName, setPatientName] = useState("");

  const [locationText, setLocationText] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isFromMapLink, setIsFromMapLink] = useState(false);

  const googleMapLink =
    lat !== null && lng !== null
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;

  /* ---------------------------
     ASSIGN UNIT
  ----------------------------*/
  const [unitType, setUnitType] =
    useState<"ambulance" | "clinic" | "roaming" | "">("");
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");

  useEffect(() => {
    if (!unitType) {
      setUnits([]);
      return;
    }

    const collectionName =
      unitType === "ambulance"
        ? "ambulances"
        : unitType === "clinic"
        ? "destinations"
        : "Roaming";

    const unsub = onSnapshot(collection(db, collectionName), (snap) => {
      setUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [unitType]);

  /* ---------------------------
     SUBMIT
  ----------------------------*/
  const createCase = async () => {
    const now = new Date().toISOString();

    await addDoc(collection(db, "cases"), {
      projectId: params.projectId,

      callerName,
      contactNumber,

      chiefComplaint,
      level: triageLevel,
      patientName,

      location: {
        text: locationText,
        lat,
        lng,
        googleMapLink,
        source: isFromMapLink ? "google_link" : "manual",
      },

      assignedUnit:
        unitType && selectedUnitId
          ? {
              type: unitType,
              id: selectedUnitId,
            }
          : null,

      status: "Received",
      createdAt: serverTimestamp(),
      timeline: {
        Received: now,
      },
    });

    router.push(`/dev/projects/${params.projectId}/cad`);
  };

  /* ---------------------------
     UI
  ----------------------------*/
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-white">
        New Case (Project)
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================= FORM ================= */}
        <div className="bg-[#1c2333] border border-gray-700 rounded-lg p-4 space-y-5">

          {/* Caller */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel text="Caller Name" />
              <input
                className={inputClass}
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
              />
            </div>

            <div>
              <FieldLabel text="Contact Number" />
              <input
                className={inputClass}
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Case */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel text="Chief Complaint" />
              <input
                className={inputClass}
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
              />
            </div>

            <div>
              <FieldLabel text="Triage Level" />
              <input
                className={inputClass}
                value={triageLevel}
                onChange={(e) => setTriageLevel(e.target.value)}
              />
            </div>
          </div>

          <div>
            <FieldLabel text="Patient Name" />
            <input
              className={inputClass}
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="border border-gray-700 rounded p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">
              Location Information
            </h3>

            <FieldLabel text="Location Description" />
            <input
              className={inputClass}
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />

            <FieldLabel text="Google Maps Link (Auto-Pin)" />
            <input
              className={inputClass}
              placeholder="Paste Google Maps link here"
              value={mapLink}
              onChange={(e) => {
                const value = e.target.value;
                setMapLink(value);

                if (!value) {
                  setIsFromMapLink(false);
                  return;
                }

                const coords = extractLatLngFromGoogleMaps(value);
                if (coords) {
                  setLat(coords.lat);
                  setLng(coords.lng);
                  setIsFromMapLink(true);
                }
              }}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel text="Latitude" />
                <input
                  disabled={isFromMapLink}
                  className={`${inputClass} ${
                    isFromMapLink
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  value={lat ?? ""}
                  onChange={(e) =>
                    setLat(e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>

              <div>
                <FieldLabel text="Longitude" />
                <input
                  disabled={isFromMapLink}
                  className={`${inputClass} ${
                    isFromMapLink
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  value={lng ?? ""}
                  onChange={(e) =>
                    setLng(e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </div>

            {googleMapLink && (
              <a
                href={googleMapLink}
                target="_blank"
                className="text-blue-400 text-sm underline"
              >
                Open in Google Maps
              </a>
            )}
          </div>

          {/* Assign Unit */}
          <div className="border border-gray-700 rounded p-4 space-y-3">
            <h3 className="text-white text-sm font-semibold">
              Assign Unit
            </h3>

            <div className="flex gap-6 text-white text-sm">
              {["ambulance", "clinic", "roaming"].map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={unitType === t}
                    onChange={() =>
                      setUnitType(t as "ambulance" | "clinic" | "roaming")
                    }
                  />
                  {t}
                </label>
              ))}
            </div>

            {unitType && units.length > 0 && (
              <select
                className={inputClass}
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
              >
                <option value="">Select unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code || u.name || u.id}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={createCase}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold"
          >
            Create Case
          </button>
        </div>

        {/* ================= MAP ================= */}
        <div className="h-[520px] border border-gray-700 rounded-lg overflow-hidden">
          <Map
            caseLat={lat ?? undefined}
            caseLng={lng ?? undefined}
            caseName={locationText}
            ambulances={unitType === "ambulance" ? units : []}
            clinics={unitType === "clinic" ? units : []}
            roaming={unitType === "roaming" ? units : []}
          />
        </div>
      </div>
    </div>
  );
}
