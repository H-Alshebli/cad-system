"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import StatusButtons from "@/app/components/StatusButtons";
import Map from "@/app/components/Map";

export default function CaseDetails({ params }: { params: { id: string } }) {
  const caseId = params.id;
  const [caseData, setCaseData] = useState<any>(null);

  useEffect(() => {
    const ref = doc(db, "cases", caseId);

    // 🔥 Live listener (auto update page)
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        // Parse lat/lng if stored as string "24.8 , 46.6"
        let latitude = data.latitude;
        let longitude = data.longitude;

        if (!latitude && data.location) {
          const parts = data.location.split(",");
          latitude = parseFloat(parts[0]);
          longitude = parseFloat(parts[1]);
        }

        setCaseData({
          ...data,
          latitude,
          longitude,
        });
      }
    });

    return () => unsubscribe();
  }, [caseId]);

  if (!caseData) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Case Details</h1>

      <p><strong>Name:</strong> {caseData.patientName || "N/A"}</p>
      <p><strong>Complaint:</strong> {caseData.chiefComplaint || "N/A"}</p>
      <p><strong>Level:</strong> {caseData.level || "N/A"}</p>
      <p><strong>Status:</strong> {caseData.status || "N/A"}</p>

      <p><strong>Location:</strong>  
        {caseData.latitude && caseData.longitude 
          ? `${caseData.latitude}, ${caseData.longitude}` 
          : "N/A"}
      </p>

      <div className="mt-6">
        <StatusButtons caseId={caseId} currentStatus={caseData.status} />
      </div>

      {caseData.latitude && caseData.longitude ? (
        <div className="mt-6">
          <Map
            latitude={caseData.latitude}
            longitude={caseData.longitude}
            name={caseData.patientName}
          />
        </div>
      ) : null}
    </div>
  );
}
