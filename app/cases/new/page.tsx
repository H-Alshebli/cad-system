"use client";

import { useState, FormEvent } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function NewCasePage() {
  const [patientName, setPatientName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [level, setLevel] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const createCase = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, "cases"), {
        patientName,
        chiefComplaint,
        level,
        location,
        status: "Received",
        timestamp: serverTimestamp(),
        dispatcherId: "demo-dispatcher", // later: real user id
        ambulanceId: null,
      });

      alert("Case created successfully!");

      // Clear form
      setPatientName("");
      setChiefComplaint("");
      setLevel("");
      setLocation("");
    } catch (error) {
      console.error("Error creating case:", error);
      alert("Failed to create case");
    }

    setLoading(false);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create New Case</h1>

      <form onSubmit={createCase} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Patient Name
          </label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Chief Complaint
          </label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            placeholder="Chest pain, difficulty breathing..."
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Level (Triage)
          </label>
          <select
            className="w-full border p-2 rounded"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            required
          >
            <option value="">Select Level</option>
            <option value="1">Level 1 - Critical</option>
            <option value="2">Level 2 - Emergency</option>
            <option value="3">Level 3 - Urgent</option>
            <option value="4">Level 4 - Non-Urgent</option>
            <option value="5">Level 5 - Minor</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Location
          </label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            placeholder="24.7136, 46.6753 or address"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Case"}
        </button>
      </form>
    </div>
  );
}
