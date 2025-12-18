"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

export default function ProjectDetailsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "projects", params.projectId),
      (snap) => {
        setProject({ id: snap.id, ...snap.data() });
      }
    );

    return () => unsub();
  }, [params.projectId]);

  if (!project) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{project.projectName}</h1>
      <div className="text-muted-foreground">{project.client}</div>

      <div className="p-4 bg-card rounded border">
        <div>Status: {project.status}</div>
        <div>Project ID: {project.id}</div>
      </div>
    </div>
  );
}
