"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Map from "@/app/components/Map";

interface CaseData {
  patientName: string;
  chiefComplaint: string;
  level: string;
  status: string;
  locationText: string;
  lat: number | string;
  lng: number | string;
  ambulanceId?: string;
}

export default function ClientCaseDetails({ caseId }: { caseId: string }) {
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load case
        const ref = doc(db, "cases", caseId);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setCaseData(snap.data() as CaseData);
        } else {
          setCaseData(null);
        }

        // Load ambulances list
        const ambSnap = await getDocs(collection(db, "ambulances"));
        const ambList: any[] = [];
        ambSnap.forEach((d) => ambList.push({ id: d.id, ...d.data() }));
        setAmbulances(ambList);
      } catch (err) {
        console.error("Error loading data:", err);
      }

      setLoading(false);
    };

    loadData();
  }, [caseId]);

  if (loading) return <p>Loading...</p>;
  if (!caseData) return <p>Case not found.</p>;

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

      {/* MAP */}
      {caseData.lat && caseData.lng && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-2">Location Map</h2>
          <Map
            lat={Number(caseData.lat)}
            lng={Number(caseData.lng)}
            label={caseData.locationText}
          />
        </div>
      )}
    </div>
  );
}
