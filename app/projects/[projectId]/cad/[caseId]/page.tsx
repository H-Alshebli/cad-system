"use client";

import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StatusButtons from "@/app/components/StatusButtons";
import CaseTimeline from "@/app/components/CaseTimeline";
import { createEpcrFromCase, getEpcrByCaseId } from "@/lib/epcr";

/* -----------------------------
   TYPES
------------------------------ */
type PatientInfo = {
  idNumber?: string;
  name?: string;
  age?: number | null;
  gender?: "male" | "female" | "";
  phone?: string;
  notes?: string;
};

type CaseType = {
  id: string;
  status: string;
  lazemCode?: string;
  projectId?: string | null;
  timeline?: Record<string, any>;
  patient?: PatientInfo;
};

/* -----------------------------
   PAGE
------------------------------ */
export default function CaseDetailsPage({
  params,
}: {
  params: { projectId: string; caseId: string };
}) {
  const { caseId } = params;
  const router = useRouter();

  const userId = "system-dev";

  const [caseData, setCaseData] = useState<CaseType | null>(null);
  const [loading, setLoading] = useState(true);

  const [epcr, setEpcr] = useState<any | null>(null);
  const [epcrLoading, setEpcrLoading] = useState(false);

  /* -----------------------------
     PATIENT EDIT STATE
  ------------------------------ */
  const [editPatient, setEditPatient] = useState(false);
  const [patientDraft, setPatientDraft] = useState<PatientInfo>({});

  /* --------------------------------
     LOAD CASE (Realtime)
  --------------------------------- */
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cases", caseId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...(snap.data() as any) };
const patient = data.patient || {};

setCaseData({
  ...data,
  patient: {
    ...patient,
    name: patient.name || data.patientName || "",
    phone: patient.phone || data.contactNumber || "",
  },
});

setPatientDraft({
  ...patient,
  name: patient.name || data.patientName || "",
  phone: patient.phone || data.contactNumber || "",
});


      }
      setLoading(false);
    });

    return () => unsub();
  }, [caseId]);

  /* --------------------------------
     CHECK ePCR
  --------------------------------- */
  useEffect(() => {
    const checkEpcr = async () => {
      const existing = await getEpcrByCaseId(caseId);
      setEpcr(existing);
    };
    checkEpcr();
  }, [caseId]);

  if (loading) return <div className="p-6">Loading case...</div>;
  if (!caseData) return <div className="p-6">Case not found</div>;

  /* --------------------------------
     ePCR HANDLER
  --------------------------------- */
  const handleEpcr = async () => {
    setEpcrLoading(true);

    if (epcr) {
      router.push(`/epcr/${epcr.id}`);
      return;
    }

    const epcrId = await createEpcrFromCase(caseData, userId);
    setEpcr({ id: epcrId });
    router.push(`/epcr/${epcrId}`);
  };

  /* --------------------------------
     SAVE PATIENT INFO
  --------------------------------- */
  const savePatientInfo = async () => {
    await updateDoc(doc(db, "cases", caseId), {
      patient: patientDraft,
    });
    setEditPatient(false);
  };

  return (
    <div className="p-6 space-y-6">

      {/* =============================
          HEADER
      ============================== */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Case #{caseData.lazemCode || caseData.id}
          </h1>
          <p className="text-sm text-gray-400">
            Status: <span className="text-green-400">{caseData.status}</span>
          </p>
        </div>

        <button
          onClick={handleEpcr}
          disabled={epcrLoading}
          className={`px-4 py-2 rounded text-sm text-white ${
            epcr ? "bg-indigo-600" : "bg-purple-600"
          }`}
        >
          {epcrLoading
            ? "Opening ePCR..."
            : epcr
            ? "View ePCR"
            : "Create ePCR"}
        </button>
      </div>

      {/* =============================
          STATUS + TIMELINE
      ============================== */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">
          Update Status
        </h3>

        <StatusButtons
          caseId={caseData.id}
          currentStatus={caseData.status}
        />

        {caseData.timeline && (
          <div className="pt-4 border-t border-slate-700">
            <h3 className="text-sm font-semibold mb-2 text-gray-200">
              Timeline
            </h3>

            <CaseTimeline
              timeline={Object.fromEntries(
                Object.entries(caseData.timeline).map(
                  ([status, time]) => [status, time]
                )
              )}
            />
          </div>
        )}
      </div>

      {/* =============================
          PATIENT INFORMATION
      ============================== */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-200">
            Patient Information
          </h3>

          {!editPatient ? (
            <button
              onClick={() => setEditPatient(true)}
              className="text-xs text-blue-400 hover:underline"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={savePatientInfo}
                className="text-xs text-green-400 hover:underline"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setPatientDraft(caseData.patient || {});
                  setEditPatient(false);
                }}
                className="text-xs text-gray-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* ID */}
          <div>
            <label className="text-gray-400">Patient ID</label>
            {editPatient ? (
              <input
                className="w-full mt-1 p-2 rounded bg-slate-800 text-white border border-slate-700"
                value={patientDraft.idNumber || ""}
                onChange={(e) =>
                  setPatientDraft({
                    ...patientDraft,
                    idNumber: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-white">
                {caseData.patient?.idNumber || "—"}
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="text-gray-400">Name</label>
            {editPatient ? (
              <input
                className="w-full mt-1 p-2 rounded bg-slate-800 text-white border border-slate-700"
                value={patientDraft.name || ""}
                onChange={(e) =>
                  setPatientDraft({
                    ...patientDraft,
                    name: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-white">
                {caseData.patient?.name || "—"}
              </p>
            )}
          </div>

          {/* Age */}
          <div>
            <label className="text-gray-400">Age</label>
            {editPatient ? (
              <input
                type="number"
                className="w-full mt-1 p-2 rounded bg-slate-800 text-white border border-slate-700"
                value={patientDraft.age ?? ""}
                onChange={(e) =>
                  setPatientDraft({
                    ...patientDraft,
                    age: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            ) : (
              <p className="text-white">
                {caseData.patient?.age ?? "—"}
              </p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="text-gray-400">Gender</label>
            {editPatient ? (
              <select
                className="w-full mt-1 p-2 rounded bg-slate-800 text-white border border-slate-700"
                value={patientDraft.gender || ""}
                onChange={(e) =>
                  setPatientDraft({
                    ...patientDraft,
                    gender: e.target.value as any,
                  })
                }
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            ) : (
              <p className="text-white capitalize">
                {caseData.patient?.gender || "—"}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="text-gray-400">Phone</label>
            {editPatient ? (
              <input
                className="w-full mt-1 p-2 rounded bg-slate-800 text-white border border-slate-700"
                value={patientDraft.phone || ""}
                onChange={(e) =>
                  setPatientDraft({
                    ...patientDraft,
                    phone: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-white">
                {caseData.patient?.phone || "—"}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <label className="text-gray-400">Notes</label>
            {editPatient ? (
              <textarea
                className="w-full mt-1 p-2 rounded bg-slate-800 text-white border border-slate-700"
                rows={3}
                value={patientDraft.notes || ""}
                onChange={(e) =>
                  setPatientDraft({
                    ...patientDraft,
                    notes: e.target.value,
                  })
                }
              />
            ) : (
              <p className="text-white">
                {caseData.patient?.notes || "—"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* =============================
          NEXT SECTIONS
      ============================== */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-gray-400 text-sm">
          Case Information (next)
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-gray-400 text-sm">
          Case Chat (next)
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-gray-400 text-sm h-[300px]">
        Patient Location Map (next)
      </div>

    </div>
  );
}
