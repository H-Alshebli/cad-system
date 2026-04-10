"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import CasesOverview from "@/app/components/CasesOverview";

export default function ProjectDetailsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [project, setProject] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      const ref = doc(db, "projects", params.projectId);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProject({ id: snap.id, ...snap.data() });
      }
    };

    loadProject();
  }, [params.projectId]);

  useEffect(() => {
    const q = query(
      collection(db, "cases"),
      where("projectId", "==", params.projectId)
    );

    const unsub = onSnapshot(q, (snap) => {
      setCases(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
      setLoading(false);
    });

    return () => unsub();
  }, [params.projectId]);

  if (loading || !project) {
    return <div className="p-6">Loading project...</div>;
  }

  return (
    <div className="space-y-6">
      <CasesOverview title="Cases" cases={cases} />
    </div>
  );
}