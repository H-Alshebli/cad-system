"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

import CasesOverview from "@/app/components/CasesOverview";

export default function ProjectDetailsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "cases"),
      where("projectId", "==", params.projectId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setCases(data);
      setLoading(false);
    });

    return () => unsub();
  }, [params.projectId]);

  if (loading) {
    return <div className="p-6">Loading overview...</div>;
  }

 return (
  <CasesOverview
    title="MDL Soundstorm 25 — Overview"
    cases={cases}
  />
);
}
