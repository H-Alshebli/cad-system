"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function AmbulancesPage() {
  const [ambulances, setAmbulances] = useState<any[]>([]);

  // FORM FIELDS
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [crew1, setCrew1] = useState("");
  const [crew2, setCrew2] = useState("");
  const [status, setStatus] = useState("available");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // LISTENER: LOAD AMBULANCES
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAmbulances(list);
    });
    return () => unsub();
  }, []);

  // ADD NEW AMBULANCE
  const addAmbulance = async () => {
    if (!code || !crew1 || !location) return;

    await addDoc(collection(db, "ambulances"), {
      code,
      location,
      crew: [crew1, crew2],
      status,
      currentCase: null, // 🔥 ALWAYS NULL — AUTO UPDATED LATER
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      createdAt: serverTimestamp(),
    });

    // CLEAR FIELDS
    setCode("");
    setLocation("");
    setCrew1("");
    setCrew2("");
    setStatus("available");
    setLat("");
    setLng("");
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Ambulances</h1>

      {/* ADD FORM */}
      <div className="p-4 mb-6 bg-white dark:bg-gray-800 rounded shadow border">
        <h2 className="text-xl font-semibold mb-4">Add New Ambulance</h2>

        <input
          type="text"
          placeholder="Ambulance Code (e.g. AMB-003)"
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
          placeholder="Zone / Location"
          className="w-full p-2 mb-3 rounded bg-gray-100 dark:bg-gray-700"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
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
 {/* 
       <button
          onClick={addAmbulance}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Add Ambulance
        </button>*/}
      </div>

      {/* LIST OF AMBULANCES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ambulances.map((amb) => (
          <div
            key={amb.id}
            className="p-4 border rounded bg-white dark:bg-gray-800 shadow"
          >
            <h2 className="text-xl font-bold">{amb.code}</h2>
            <p>Status: {amb.status}</p>
            <p>Zone: {amb.location}</p>
            <p>Crew: {amb.crew?.join(", ")}</p>

            <p>
              Current Case:{" "}
              <span className="font-semibold">
                {amb.currentCase ?? "None"}
              </span>
            </p>

            {amb.lat && amb.lng ? (
              <button
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps?q=${amb.lat},${amb.lng}`,
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
