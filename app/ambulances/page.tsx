"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";

export default function AmbulancesPage() {
  const [ambulances, setAmbulances] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "ambulances"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAmbulances(list);
    });

    return () => unsub();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Ambulances</h1>

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

            {/* Navigate Button */}
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
          </div>
        ))}
      </div>
    </div>
  );
}
