"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import StatusButtons from "@/app/components/StatusButtons";

export default function CaseDetails({ params }: { params: { id: string } }) {
  const caseId = params.id;
  const [caseData, setCaseData] = useState<any>(null);

  useEffect(() => {
    const loadCase = async () => {
      const ref = doc(db, "cases", caseId);
      const snap = await getDoc(ref);
      if (snap.exists()) setCaseData(snap.data());
    };

    loadCase();
  }, [caseId]);

  if (!caseData) return <p>Loading case...</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Case Details</h1>

      <p><strong>Name:</strong> {caseData.name}</p>
      <p><strong>Complaint:</strong> {caseData.complaint}</p>
      <p><strong>Status:</strong> {caseData.status}</p>

      {/* ✅ Status update buttons appear here */}
      <StatusButtons 
        caseId={caseId} 
        currentStatus={caseData.status} 
      />
    </div>
  );
}
