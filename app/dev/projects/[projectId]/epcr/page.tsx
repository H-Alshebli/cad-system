"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ProjectEpcrPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [epcrs, setEpcrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "epcr"),
      where("projectId", "==", params.projectId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setEpcrs(data);
      setLoading(false);
    });

    return () => unsub();
  }, [params.projectId]);

  if (loading) return <div className="p-4">Loading ePCR...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Project ePCR</h2>

      {epcrs.length === 0 && (
        <div className="text-muted-foreground">
          No ePCR records for this project yet.
        </div>
      )}

      <div className="grid gap-4">
        {epcrs.map((e) => (
          <Link
            key={e.id}
          href={`/epcr/${e.id}`}
            className="p-4 bg-card border rounded block"
          >
            <div className="font-semibold">
              Case: {e.caseId}
            </div>
            <div className="text-sm text-muted-foreground">
              Created:{" "}
              {e.createdAt?.seconds
                ? new Date(
                    e.createdAt.seconds * 1000
                  ).toLocaleString()
                : "-"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
