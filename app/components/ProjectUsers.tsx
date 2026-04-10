"use client";

import { useEffect, useMemo, useState } from "react";
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
  name?: string;
  email?: string;
  role?: string;
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Paramedics: false,
    Managers: false,
    Sales: false,
    Pending: false,
    Others: false,
  });

  useEffect(() => {
    setSelected(assignedUsers || {});
  }, [assignedUsers]);

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

  const toggleUser = (uid: string) => {
    setSelected((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const toggleSection = (sectionName: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const save = async () => {
    await updateDoc(doc(db, "projects", projectId), {
      assignedUsers: selected,
    });
    alert("Assigned users updated");
  };

  const groupedUsers = useMemo(() => {
    const groups: Record<string, User[]> = {
      Paramedics: [],
      Managers: [],
      Sales: [],
      Pending: [],
      Others: [],
    };

    users
      .filter((u) => u.role !== "admin")
      .forEach((u) => {
        const roleText = String(u.role || "").toLowerCase();
        const nameText = String(u.name || "").toLowerCase();

        if (roleText.includes("paramedic")) {
          groups.Paramedics.push(u);
        } else if (
          roleText.includes("manager") ||
          roleText.includes("quality")
        ) {
          groups.Managers.push(u);
        } else if (roleText.includes("sales")) {
          groups.Sales.push(u);
        } else if (
          roleText.includes("pending") ||
          nameText.includes("pending")
        ) {
          groups.Pending.push(u);
        } else {
          groups.Others.push(u);
        }
      });

    return Object.entries(groups).filter(([, list]) => list.length > 0);
  }, [users]);

  return (
    <Can permission="projects.edit">
      <div className="space-y-4">
        <div className="border rounded p-4 bg-white dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg dark:text-white">
                Assigned Team
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Select the users assigned to this project
              </p>
            </div>

            <button
              onClick={save}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition whitespace-nowrap"
            >
              Save Assignments
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {groupedUsers.map(([groupName, groupUsers]) => {
            const isOpen = openSections[groupName] ?? false;

            return (
              <div
                key={groupName}
                className="border rounded p-4 bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold dark:text-white">
                      {groupName}
                    </h4>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {groupUsers.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSection(groupName)}
                    className="px-3 py-1 text-sm rounded border bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/40 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700 transition"
                  >
                    {isOpen ? "Hide" : "Show"}
                  </button>
                </div>

                {isOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    {groupUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer bg-gray-50 dark:bg-gray-900/40 dark:border-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={!!selected[u.id]}
                          onChange={() => toggleUser(u.id)}
                          className="mt-1"
                        />

                        <div className="min-w-0">
                          <div className="font-medium dark:text-white">
                            {u.name || "Unknown User"}
                          </div>
                          <div className="text-sm text-gray-400">
                            {u.role || "No role"}
                          </div>
                          {u.email && (
                            <div className="text-xs text-gray-500 truncate">
                              {u.email}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Can>
  );
}