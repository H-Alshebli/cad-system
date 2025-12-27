"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  const pathname = usePathname();
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

  if (!project) return <div className="p-6">Loading project...</div>;

  const tabs = [
    { label: "Dashboard", href: `/projects/${params.projectId}` },
    { label: "CAD", href: `/projects/${params.projectId}/cad` },
    { label: "ePCR", href: `/projects/${params.projectId}/epcr` },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{project.projectName}</h1>
        <div className="text-sm text-muted-foreground">
          {project.client} • {project.status}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-4 py-2 text-sm rounded-t
                ${
                  active
                    ? "bg-card border border-b-0 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
