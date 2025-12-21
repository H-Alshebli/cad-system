"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StatusButtons from "@/app/components/StatusButtons";
import CaseTimeline from "@/app/components/CaseTimeline";
import { createEpcrFromCase, getEpcrByCaseId } from "@/lib/epcr";

/* -----------------------------
   TYPES
------------------------------ */
type CaseType = {
  id: string;
  status: string;
  lazemCode?: string;
  projectId?: string | null;
  timeline?: Record<string, any>;
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

  /* --------------------------------
     LOAD CASE (Realtime)
  --------------------------------- */
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "cases", caseId), (snap) => {
      if (snap.exists()) {
        setCaseData({ id: snap.id, ...(snap.data() as any) });
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
          PLACEHOLDERS (Next Steps)
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
