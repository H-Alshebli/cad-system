"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";

export default function CasesDashboard() {
  const [cases, setCases] = useState<any[]>([]);

  useEffect(() => {
    // Listen to cases collection in real-time
    const unsub = onSnapshot(collection(db, "cases"), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCases(list);
    });

    return () => unsub();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dispatch Dashboard</h1>

      <div className="space-y-3">
        {cases.map((c) => (
          <Link key={c.id} href={`/cases/${c.id}`}>
            <div className="border p-4 rounded shadow-sm bg-white cursor-pointer hover:bg-gray-100">
              <h2 className="text-xl font-bold">{c.patientName}</h2>
              <p><strong>Complaint:</strong> {c.chiefComplaint}</p>
              <p><strong>Level:</strong> {c.level}</p>
              <p><strong>Status:</strong> {c.status}</p>
              <p><strong>AmbulanceAssign:</strong> {c.ambulanceId}</p>
              <p><strong>Location:</strong> {c.location}</p>
              <p className="text-gray-400 text-sm mt-1">Click to open →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
