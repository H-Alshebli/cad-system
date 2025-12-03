"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

import StatusButtons from "@/app/components/StatusButtons";
import Map from "@/app/components/Map";

interface CaseData {
  patientName?: string;
  chiefComplaint?: string;
  level?: number;
  status?: string;
  locationText?: string;
  lat?: number | string;
  lng?: number | string;
  ambulanceId?: string;
}

export default function CaseDetails({ params }: { params: { id: string } }) {
  const caseId = params.id;

  const [caseData, setCaseData] = useState<CaseData | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cases", caseId), (snapshot) => {
      if (snapshot.exists()) {
        setCaseData(snapshot.data() as CaseData);
      }
    });

    return () => unsub();
  }, [caseId]);

  if (!caseData) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Case Details</h1>

      <div className="bg-white border p-4 rounded-lg shadow-sm">
        <p><strong>Patient:</strong> {caseData.patientName}</p>
        <p><strong>Complaint:</strong> {caseData.chiefComplaint}</p>
        <p><strong>Level:</strong> {caseData.level}</p>
        <p><strong>Status:</strong> {caseData.status}</p>
        <p><strong>Location:</strong> {caseData.locationText}</p>
        <p><strong>Ambulance:</strong> {caseData.ambulanceId || "None assigned"}</p>
      </div>

      <div className="mt-6">
        <StatusButtons caseId={caseId} currentStatus={caseData.status || ""} />
      </div>

      {caseData.lat && caseData.lng ? (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-2">Location Map</h2>

          <Map
            latitude={Number(caseData.lat)}
            longitude={Number(caseData.lng)}
            name={caseData.locationText || "Location"}
          />
        </div>
      ) : null}
    </div>
  );
}
