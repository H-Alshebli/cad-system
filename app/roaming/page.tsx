"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function RoamingPage() {
  const [roaming, setRoaming] = useState<any[]>([]);

  // FORM FIELDS
  const [code, setCode] = useState("");
  const [zone, setZone] = useState("");
  const [crew1, setCrew1] = useState("");
  const [crew2, setCrew2] = useState("");
  const [status, setStatus] = useState("available");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // LISTENER → Load Roaming units
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "Roaming"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRoaming(list);
    });
    return () => unsub();
  }, []);

  // ADD NEW ROAMING UNIT
  const addRoaming = async () => {
    if (!code || !crew1 || !zone) return;

    await addDoc(collection(db, "Roaming"), {
      code,
      crew: [crew1, crew2],
      status,
      zone,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      currentCase: null,
      createdAt: serverTimestamp(),
    });

    // Clear form
    setCode("");
    setZone("");
    setCrew1("");
    setCrew2("");
    setStatus("available");
    setLat("");
    setLng("");
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Roaming Units</h1>

      {/* ADD FORM */}
      <div className="p-4 mb-6 bg-white dark:bg-gray-800 rounded shadow border">
        <h2 className="text-xl font-semibold mb-4">Add New Roaming Unit</h2>

        <input
          type="text"
          placeholder="Roaming Code (e.g. R-0111)"
          className="w-full p-2 mb-3 rounded bg-gray-100 dark:bg-gray-700"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <input
          type="text"
          placeholder="Crew 1"
          className="w-full p-2 mb-3 rounded bg-gray-100 dark:bg-gray-700"
          value={crew1}
          onChange={(e) => setCrew1(e.target.value)}
        />

        <input
          type="text"
          placeholder="Crew 2 (optional)"
          className="w-full p-2 mb-3 rounded bg-gray-100 dark:bg-gray-700"
          value={crew2}
          onChange={(e) => setCrew2(e.target.value)}
        />

        <input
          type="text"
          placeholder="Zone"
          className="w-full p-2 mb-3 rounded bg-gray-100 dark:bg-gray-700"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
        />

        <input
          type="number"
          placeholder="Latitude (optional)"
          className="w-full p-2 mb-3 rounded bg-gray-100 dark:bg-gray-700"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />

        <input
          type="number"
          placeholder="Longitude (optional)"
          className="w-full p-2 mb-3 rounded bg-gray-100 dark:bg-gray-700"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
        />

        <select
          className="w-full p-2 mb-3 bg-gray-100 dark:bg-gray-700 rounded"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </select>

        <button
          onClick={addRoaming}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Add Roaming Unit
        </button>
      </div>

      {/* LIST OF ROAMING UNITS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roaming.map((r) => (
          <div
            key={r.id}
            className="p-4 border rounded bg-white dark:bg-gray-800 shadow"
          >
            <h2 className="text-xl font-bold">{r.code}</h2>
            <p>Status: {r.status}</p>
            <p>Zone: {r.zone}</p>
            <p>Crew: {r.crew?.join(", ")}</p>

            <p>
              Current Case:{" "}
              <span className="font-semibold">{r.currentCase ?? "None"}</span>
            </p>

            {r.lat && r.lng ? (
              <button
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps?q=${r.lat},${r.lng}`,
                    "_blank"
                  )
                }
                className="mt-3 w-full bg-blue-600 text-white p-2 rounded"
              >
                Navigate
              </button>
            ) : (
              <p className="text-gray-400 mt-2">No GPS attached</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
