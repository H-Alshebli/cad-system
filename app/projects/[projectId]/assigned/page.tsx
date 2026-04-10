"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProjectUsers from "@/app/components/ProjectUsers";

export default function ProjectAssignedPage({
  params,
}: {
  params: { projectId: string };
}) {
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      const ref = doc(db, "projects", params.projectId);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProject({ id: snap.id, ...snap.data() });
      }

      setLoading(false);
    };

    loadProject();
  }, [params.projectId]);

  if (loading || !project) {
    return <div className="p-6">Loading assigned users...</div>;
  }

  return (
    <div className="space-y-6">
      <ProjectUsers
        projectId={project.id}
        assignedUsers={project.assignedUsers || {}}
      />
    </div>
  );
}