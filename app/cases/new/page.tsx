"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function NewCasePage() {
  const [patientName, setPatientName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [level, setLevel] = useState("");
  const [locationInput, setLocationInput] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    // ---------- LOCATION PARSING ----------
    let lat = null;
    let lng = null;
    let locationText = locationInput.trim();

    if (locationInput.includes(",")) {
      const parts = locationInput.split(",");
      lat = Number(parts[0].trim());
      lng = Number(parts[1].trim());
    }

    // Ensure both lat & lng are valid numbers
    if (!isNaN(lat!) && !isNaN(lng!)) {
      console.log("Parsed coordinates:", lat, lng);
    } else {
      lat = null;
      lng = null;
    }

    // ---------- SAVE TO FIRESTORE ----------
    try {
      await addDoc(collection(db, "cases"), {
        patientName,
        chiefComplaint,
        level,
        dispatcherId: "demo-dispatcher",
        lat,
        lng,
        locationText,
        status: "Received",
        timestamp: serverTimestamp(),
      });

      alert("Case created successfully!");
      setPatientName("");
      setChiefComplaint("");
      setLevel("");
      setLocationInput("");
    } catch (error) {
      console.error("Error creating case:", error);
      alert("Error creating case");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create New Case</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Patient Name</label>
          <input
            className="border w-full p-2 rounded"
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Chief Complaint</label>
          <input
            className="border w-full p-2 rounded"
            type="text"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Level (Triage)</label>
          <select
            className="border w-full p-2 rounded"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            required
          >
            <option value="">Select Level</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
          </select>
        </div>

        <div>
          <label>Location</label>
          <input
            className="border w-full p-2 rounded"
            placeholder="24.7136, 46.6753"
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            required
          />
          <p className="text-sm text-gray-600 mt-1">
            Use format: <strong>latitude, longitude</strong><br />
            Example: <code>24.8743, 46.6116</code>
          </p>
        </div>

        <button
          type="submit"
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create Case
        </button>
      </form>
    </div>
  );
}
