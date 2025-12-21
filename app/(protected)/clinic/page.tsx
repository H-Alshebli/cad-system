"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "destinations"), where("type", "==", "clinic"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClinics(list);
    });

    return () => unsub();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Clinics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clinics.map((c) => (
          <div
            key={c.id}
            className="p-4 border rounded bg-white dark:bg-gray-800 shadow"
          >
            <h2 className="text-xl font-bold">{c.name}</h2>
            <p>Address: {c.address}</p>

            {/* Map Navigation */}
            <button
              onClick={() =>
                window.open(`https://www.google.com/maps?q=${c.lat},${c.lng}`, "_blank")
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
