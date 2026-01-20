"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Can from "./Can";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function ProjectUsers({
  projectId,
  assignedUsers = {},
}: {
  projectId: string;
  assignedUsers: Record<string, boolean>;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>(assignedUsers);

  /* Load users */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    });
    return () => unsub();
  }, []);

  /* Toggle assign */
  const toggleUser = (uid: string) => {
    setSelected((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  /* Save */
  const save = async () => {
    await updateDoc(doc(db, "projects", projectId), {
      assignedUsers: selected,
    });
    alert("Assigned users updated");
  };

  return (
    <Can permission="projects.edit">
      <div className="border rounded p-4 space-y-3">
        <h3 className="font-semibold">Assigned Paramedics</h3>

        <div className="space-y-2">
          {users
            .filter((u) => u.role !== "admin")
            .map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={!!selected[u.id]}
                  onChange={() => toggleUser(u.id)}
                />
                {u.name} ({u.role})
              </label>
            ))}
        </div>

        <button
          onClick={save}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save Assignments
        </button>
      </div>
    </Can>
  );
}
