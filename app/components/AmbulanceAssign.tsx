"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDocs, collection } from "firebase/firestore";

export default function AmbulanceAssign({
  caseId,
  currentAmbulanceId,
}: {
  caseId: string;
  currentAmbulanceId: string | null;
}) {
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAmbulances = async () => {
      const snap = await getDocs(collection(db, "ambulances"));
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setAmbulances(list);
      setLoading(false);
    };

    loadAmbulances();
  }, []);

  const assignAmbulance = async (ambId: string | null) => {
    await updateDoc(doc(db, "cases", caseId), {
      ambulanceId: ambId,
    });

    alert("Ambulance updated successfully!");
    location.reload(); // force refresh
  };

  if (loading) return <p>Loading ambulances...</p>;

  return (
    <div className="mt-6 bg-white p-4 border rounded shadow-sm">
      <h2 className="font-bold text-lg mb-3">Assign Ambulance</h2>

      <p className="mb-2">
        Current:{" "}
        {currentAmbulanceId ? currentAmbulanceId : "No ambulance assigned"}
      </p>

      <select
        className="border p-2 rounded w-full"
        defaultValue={currentAmbulanceId || ""}
        onChange={(e) =>
          assignAmbulance(e.target.value === "" ? null : e.target.value)
        }
      >
        <option value="">🚑 No Ambulance</option>

        {ambulances.map((amb) => (
          <option key={amb.id} value={amb.id}>
            {amb.code} — {amb.status} — {amb.location}
          </option>
        ))}
      </select>
    </div>
  );
}
