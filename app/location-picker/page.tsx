"use client";

import { useEffect, useRef, useState } from "react";
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

  const [tracking, setTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const [location, setLocation] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------
     LOAD UNITS
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
     START LIVE TRACKING
  ------------------------------------ */
  const startTracking = () => {
    if (!unitType || !selectedUnitId) {
      setError("Select unit type and unit first");
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setError(null);
    setTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setLocation(coords);

        await setDoc(
          doc(db, unitType, selectedUnitId),
          {
            lat: coords.lat,
            lng: coords.lng,
            lastUpdated: serverTimestamp(),
          },
          { merge: true }
        );
      },
      () => {
        setError("Location access denied");
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  };

  /* ------------------------------------
     STOP LIVE TRACKING
  ------------------------------------ */
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  };

  /* ------------------------------------
     CLEANUP ON PAGE LEAVE
  ------------------------------------ */
  useEffect(() => {
    return () => stopTracking();
  }, []);

  return (
    <div className="p-6 min-h-screen bg-gray-900 text-white flex flex-col gap-4 max-w-md">
      <h1 className="text-2xl font-bold">
        📡 Live Location Tracker
      </h1>

      {/* UNIT TYPE */}
      <select
        value={unitType}
        onChange={(e) => setUnitType(e.target.value as UnitType)}
        className="p-3 rounded bg-[#1c2333] border border-gray-700"
      >
        <option value="">Select Unit Type</option>
        <option value="Roaming">Roaming</option>
        <option value="ambulances">Ambulance</option>
      </select>

      {/* UNIT */}
      {unitType && (
        <select
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(e.target.value)}
          className="p-3 rounded bg-[#1c2333] border border-gray-700"
        >
          <option value="">Select Unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code}
            </option>
          ))}
        </select>
      )}

      {/* BUTTONS */}
      {!tracking ? (
        <button
          onClick={startTracking}
          className="bg-green-600 px-6 py-3 rounded font-semibold hover:bg-green-700"
        >
          ▶ Start Live Tracking
        </button>
      ) : (
        <button
          onClick={stopTracking}
          className="bg-red-600 px-6 py-3 rounded font-semibold hover:bg-red-700"
        >
          ⏹ Stop Tracking
        </button>
      )}

      {/* STATUS */}
      {location && (
        <div className="bg-[#1c2333] p-4 rounded">
          <p><strong>Latitude:</strong> {location.lat}</p>
          <p><strong>Longitude:</strong> {location.lng}</p>
          <p className="text-green-400 mt-2">
            Live tracking active
          </p>
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}
