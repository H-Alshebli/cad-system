"use client";
 
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
 
export default function EpcrPage({ params }: { params: { id: string } }) {
  const epcrId = params.id;
  const router = useRouter();
 
  const [epcr, setEpcr] = useState<any>(null);
  const [loading, setLoading] = useState(true);
 
  /* -----------------------------------------
       LOAD ePCR
  ------------------------------------------ */
  useEffect(() => {
    const ref = doc(db, "epcr", epcrId);
 
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setEpcr({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });
 
    return () => unsub();
  }, [epcrId]);
 
  if (loading) return <p className="p-6">Loading ePCR...</p>;
  if (!epcr) return <p className="p-6">ePCR not found</p>;
 
  /* -----------------------------------------
       SAVE
  ------------------------------------------ */
  const saveEpcr = async () => {
    await updateDoc(doc(db, "epcr", epcrId), {
      ...epcr,
      updatedAt: new Date(),
    });
 
    alert("ePCR saved");
  };
 
  /* =========================================
       UI
  ========================================== */
  return (
    <div className="p-6 max-w-3xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6">ePCR</h1>
 
      {/* CASE INFO (READ ONLY) */}
      <div className="border border-gray-700 p-6 rounded-lg mb-6 bg-[#0F172A]">
        <h2 className="text-xl font-bold mb-4">Case Information</h2>
 
        <label className="block text-sm mb-1">Chief Complaint</label>
        <input
          className="w-full mb-4 p-2 rounded bg-[#020617] border border-gray-700 text-white"
          value={epcr.chiefComplaint || ""}
          readOnly
        />
 
        <label className="block text-sm mb-1">Triage Level</label>
        <input
          className="w-full p-2 rounded bg-[#020617] border border-gray-700 text-white"
          value={`Level ${epcr.triageLevel}`}
          readOnly
        />
      </div>
 
      {/* PATIENT INFO */}
      <div className="border border-gray-700 p-6 rounded-lg mb-6 bg-[#0F172A]">
        <h2 className="text-xl font-bold mb-4">Patient Information</h2>
 
        <input
          className="w-full mb-3 p-2 rounded bg-[#020617] border border-gray-700 text-white"
          placeholder="Patient Name"
          value={epcr.patient?.name || ""}
          onChange={(e) =>
            setEpcr({
              ...epcr,
              patient: { ...epcr.patient, name: e.target.value },
            })
          }
        />
 
        <input
          className="w-full mb-3 p-2 rounded bg-[#020617] border border-gray-700 text-white"
          placeholder="Age"
          type="number"
          value={epcr.patient?.age || ""}
          onChange={(e) =>
            setEpcr({
              ...epcr,
              patient: { ...epcr.patient, age: Number(e.target.value) },
            })
          }
        />
 
        <select
          className="w-full mb-3 p-2 rounded bg-[#020617] border border-gray-700 text-white"
          value={epcr.patient?.gender || ""}
          onChange={(e) =>
            setEpcr({
              ...epcr,
              patient: { ...epcr.patient, gender: e.target.value },
            })
          }
        >
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
 
      {/* VITALS */}
      <div className="border border-gray-700 p-6 rounded-lg mb-6 bg-[#0F172A]">
        <h2 className="text-xl font-bold mb-4">Vitals</h2>
 
        {[
          { key: "bp", label: "Blood Pressure" },
          { key: "hr", label: "Heart Rate" },
          { key: "rr", label: "Respiratory Rate" },
          { key: "spo2", label: "SpO2" },
          { key: "temp", label: "Temperature" },
        ].map((v) => (
          <input
            key={v.key}
            className="w-full mb-3 p-2 rounded bg-[#020617] border border-gray-700 text-white"
            placeholder={v.label}
            value={epcr.vitals?.[v.key] || ""}
            onChange={(e) =>
              setEpcr({
                ...epcr,
                vitals: { ...epcr.vitals, [v.key]: e.target.value },
              })
            }
          />
        ))}
      </div>
 
      {/* CLINICAL NOTES */}
      <div className="border border-gray-700 p-6 rounded-lg mb-6 bg-[#0F172A]">
        <h2 className="text-xl font-bold mb-4">Clinical Notes</h2>
 
        <textarea
          className="w-full h-24 mb-3 p-2 rounded bg-[#020617] border border-gray-700 text-white"
          placeholder="Assessment"
          value={epcr.assessment || ""}
          onChange={(e) => setEpcr({ ...epcr, assessment: e.target.value })}
        />
 
        <textarea
          className="w-full h-24 mb-3 p-2 rounded bg-[#020617] border border-gray-700 text-white"
          placeholder="Treatment"
          value={epcr.treatment || ""}
          onChange={(e) => setEpcr({ ...epcr, treatment: e.target.value })}
        />
 
        <textarea
          className="w-full h-24 p-2 rounded bg-[#020617] border border-gray-700 text-white"
          placeholder="Outcome"
          value={epcr.outcome || ""}
          onChange={(e) => setEpcr({ ...epcr, outcome: e.target.value })}
        />
      </div>
 
      {/* ACTIONS */}
      <div className="flex gap-4">
        <button
          onClick={saveEpcr}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
        >
          Save ePCR
        </button>
 
        <button
          onClick={() => router.back()}
          className="border border-gray-600 px-6 py-2 rounded"
        >
          Back
        </button>
      </div>
    </div>
  );
}