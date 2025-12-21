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

// Client-only map
const Map = dynamic(() => import("@/app/components/Map"), { ssr: false });
function extractLatLngFromGoogleMaps(url: string) {
  // Examples:
  // https://www.google.com/maps?q=24.774265,46.738586
  // https://maps.google.com/?q=24.774265,46.738586

  const match = url.match(/q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (!match) return null;

  return {
    lat: Number(match[1]),
    lng: Number(match[2]),
  };
}

export default function NewProjectCasePage({
  params,
}: {
  params: { projectId: string };
}) {
  const router = useRouter();

  /* ---------------------------
     FORM STATE
  ----------------------------*/
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [triageLevel, setTriageLevel] = useState("");
  const [patientName, setPatientName] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [locationText, setLocationText] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

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
    if (
      !chiefComplaint ||
      !triageLevel ||
      !patientName ||
      !locationText ||
      lat === null ||
      lng === null
    ) {
      alert("Please fill all required fields");
      return;
    }

    if (!unitType || !selectedUnitId) {
      alert("Please assign a unit");
      return;
    }

    const now = new Date().toISOString();

    await addDoc(collection(db, "cases"), {
      projectId: params.projectId,

      chiefComplaint,
      level: triageLevel,
      patientName,

      location: {
        text: locationText,
        lat,
        lng,
        googleMapLink,
      },

      assignedUnit: {
        type: unitType,
        id: selectedUnitId,
      },

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
        {/* ---------------- FORM ---------------- */}
        <div className="bg-[#1c2333] border border-gray-700 rounded-lg p-4 space-y-4">
          <input
            className="w-full p-2 rounded bg-[#0f1625] text-white border border-gray-700"
            placeholder="Chief Complaint"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
          />

          <input
            className="w-full p-2 rounded bg-[#0f1625] text-white border border-gray-700"
            placeholder="Triage Level"
            value={triageLevel}
            onChange={(e) => setTriageLevel(e.target.value)}
          />

          <input
            className="w-full p-2 rounded bg-[#0f1625] text-white border border-gray-700"
            placeholder="Patient Name"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />

          {/* Location */}
          <div className="border border-gray-700 rounded p-3 space-y-2">
            <h3 className="font-semibold text-white">Location</h3>

            <input
              className="w-full p-2 rounded bg-[#0f1625] text-white border border-gray-700"
              placeholder="Location description"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />

            <input
              className="w-full p-2 rounded bg-[#0f1625] text-white border border-gray-700"
              placeholder="Latitude"
              value={lat ?? ""}
              onChange={(e) =>
                setLat(e.target.value ? Number(e.target.value) : null)
              }
            />
            <input
  className="w-full p-2 rounded bg-[#0f1625] text-white border border-gray-700"
  placeholder="Paste Google Maps link here"
  value={mapLink}
  onChange={(e) => {
    const value = e.target.value;
    setMapLink(value);

    const coords = extractLatLngFromGoogleMaps(value);
    if (coords) {
      setLat(coords.lat);
      setLng(coords.lng);
    }
  }}
/>


            <input
              className="w-full p-2 rounded bg-[#0f1625] text-white border border-gray-700"
              placeholder="Longitude"
              value={lng ?? ""}
              onChange={(e) =>
                setLng(e.target.value ? Number(e.target.value) : null)
              }
            />

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
          <div className="border border-gray-700 rounded p-3 space-y-2">
            <h3 className="font-semibold text-white">Assign Unit</h3>

            <div className="flex gap-4 text-white">
              {["ambulance", "clinic", "roaming"].map((t) => (
                <label key={t}>
                  <input
                    type="radio"
                    checked={unitType === t}
                    onChange={() =>
                      setUnitType(t as "ambulance" | "clinic" | "roaming")
                    }
                  />{" "}
                  {t}
                </label>
              ))}
            </div>

            {unitType && units.length > 0 && (
              <select
                className="w-full p-2 rounded bg-[#0f1625] text-white border border-gray-700"
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
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold"
          >
            Create Case
          </button>
        </div>

        {/* ---------------- MAP ---------------- */}
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
