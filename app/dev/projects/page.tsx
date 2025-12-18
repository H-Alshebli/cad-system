"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setProjects(data);
    });

    return () => unsub();
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link
          href="/dev/projects/new"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          + New Project
        </Link>
      </div>

      <div className="grid gap-4">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/dev/projects/${p.id}`}
            className="p-4 bg-card rounded border hover:bg-muted"
          >
            <div className="font-semibold">{p.projectName}</div>
            <div className="text-sm text-muted-foreground">
              {p.client} • {p.status}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
