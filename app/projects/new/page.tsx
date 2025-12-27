"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");

  const createProject = async () => {
    if (!projectName) return;

    const docRef = await addDoc(collection(db, "projects"), {
      projectName,
      client,
      status: "Active",
      createdAt: serverTimestamp(),
    });

    router.push(`/projects/${docRef.id}`);
  };

  return (
    <div className="p-6 space-y-4 max-w-md">
      <h1 className="text-xl font-bold">New Project</h1>

      <input
        className="w-full p-2 border rounded"
        placeholder="Project Name"
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
      />

      <input
        className="w-full p-2 border rounded"
        placeholder="Client"
        value={client}
        onChange={(e) => setClient(e.target.value)}
      />

      <button
        onClick={createProject}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Create Project
      </button>
    </div>
  );
}
