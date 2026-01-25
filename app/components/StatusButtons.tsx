"use client";

import { updateDoc, doc, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";

const statuses = [
  "Received",
  "Assigned",
  "EnRoute",
  "OnScene",
  "Transporting",
  "Hospital",
  "Closed",
];

export default function StatusButtons({
  caseId,
  currentStatus,
}: {
  caseId: string;
  currentStatus: string;
}) {
  const updateStatus = async (newStatus: string) => {
  await updateDoc(doc(db, "cases", caseId), {
    status: newStatus,
    [`timeline.${newStatus}`]: serverTimestamp(),
  });

  alert(`Status updated to: ${newStatus}`);
};


  return (
    <div>
      <h3 className="font-bold mb-2">Update Status</h3>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            className={`py-2 rounded text-white font-medium ${
              currentStatus === s ? "bg-green-600" : "bg-blue-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
