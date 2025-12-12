"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* -----------------------------
   TYPES
------------------------------ */
type Unit = {
  id: string;
  code: string;
};

type LatLng = {
  lat: number;
  lng: number;
};

type UnitType = "Roaming" | "ambulances" | "";

/* -----------------------------
   PAGE
------------------------------ */
export default function LocationPickerPage() {
  const [unitType, setUnitType] = useState<UnitType>("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [location, setLocation] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* ------------------------------------
     LOAD UNITS BASED ON TYPE
  ------------------------------------ */
  useEffect(() => {
    if (!unitType) return;

    const loadUnits = async () => {
      const snap = await getDocs(collection(db, unitType));
      const list: Unit[] = snap.docs.map((d) => ({
        id: d.id,
        code: d.data().code,
      }));
      setUnits(list);
      setSelectedUnitId("");
    };

    loadUnits();
  }, [unitType]);

  /* ------------------------------------
     GET GPS + UPDATE SELECTED UNIT
  ------------------------------------ */
  const getAndUpdateLocation = async () => {
    if (!unitType || !selectedUnitId) {
      setError("Please select unit type and unit");
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setLocation(coords);

        // 🔥 UPDATE FIRESTORE
        await setDoc(
          doc(db, unitType, selectedUnitId),
          {
            lat: coords.lat,
            lng: coords.lng,
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );

        setSuccess("Location updated successfully ✅");
        setLoading(false);
      },
      () => {
        setError("Location access denied");
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="p-6 min-h-screen bg-gray-900 text-white flex flex-col gap-4 max-w-md">
      <h1 className="text-2xl font-bold">
        📍 Update Unit Location
      </h1>

      {/* UNIT TYPE SELECT */}
      <select
        value={unitType}
        onChange={(e) => setUnitType(e.target.value as UnitType)}
        className="p-3 rounded bg-[#1c2333] text-white border border-gray-700"
      >
        <option value="">Select Unit Type</option>
        <option value="Roaming">Roaming</option>
        <option value="ambulances">Ambulance</option>
      </select>

      {/* UNIT SELECT */}
      {unitType && (
        <select
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(e.target.value)}
          className="p-3 rounded bg-[#1c2333] text-white border border-gray-700"
        >
          <option value="">Select Unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code}
            </option>
          ))}
        </select>
      )}

      {/* BUTTON */}
      <button
        onClick={getAndUpdateLocation}
        disabled={loading}
        className="bg-blue-600 px-6 py-3 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Updating location..." : "Get My Location"}
      </button>

      {/* MESSAGES */}
      {error && <p className="text-red-400">{error}</p>}
      {success && <p className="text-green-400">{success}</p>}

      {/* RESULT */}
      {location && (
        <div className="bg-[#1c2333] p-4 rounded">
          <p><strong>Latitude:</strong> {location.lat}</p>
          <p><strong>Longitude:</strong> {location.lng}</p>
        </div>
      )}
    </div>
  );
}
