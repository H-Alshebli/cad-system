"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { medicalReviewLabel } from "@/lib/epcrMedicalReview";

export default function MedicalReviewPage() {
  const { user } = useCurrentUser();
  const { can, loading } = usePermissions(user?.role);
  const allowed = can("epcr_medical_review", "view");
  const [status, setStatus] = useState("pending");
  const [size, setSize] = useState(50);
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState("Loading…");
  useEffect(() => {
    setRows([]);
    if (!allowed) return;
    setMessage("Loading…");
    return onSnapshot(query(collection(db, "epcr"), where("medicalReview.status", "==", status), limit(size)), snapshot => {
      setRows(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setMessage(snapshot.empty ? "No reports in this review state." : "");
    }, () => setMessage("Unable to load review queue. Check permissions and connection."));
  }, [allowed, status, size]);
  if (loading) return <p className="p-6">Loading permissions…</p>;
  if (!allowed) return <p className="p-6">Medical review access is required.</p>;
  return <main className="p-6 space-y-5 text-[#274C5A]">
    <header><h1 className="text-2xl font-black">Medical Review</h1><p className="mt-2">All projects · Submitted reports remain locked until returned for correction.</p></header>
    <label className="block">Review status <select className="ml-3 rounded-lg border p-2" value={status} onChange={e => { setStatus(e.target.value); setSize(50); }}>
      <option value="pending">Pending Medical Review</option><option value="returned">Returned for Correction</option><option value="approved">Medically Approved</option>
    </select></label>
    <p role="status">{message}</p>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm">
      <thead className="bg-slate-50"><tr>{["Report", "Case", "Project", "Review", "Submitted", "Action"].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-t">
        <td className="p-4">{row.epcrNumber || row.id}</td><td className="p-4">{row.caseNumber || "—"}</td>
        <td className="p-4">{row.projectInfo?.projectName || row.projectName || "—"}</td><td className="p-4">{medicalReviewLabel(row)}</td>
        <td className="p-4">{row.medicalReview?.submittedAt ? new Date(row.medicalReview.submittedAt).toLocaleString() : "—"}</td>
        <td className="p-4"><Link className="underline font-bold" href={`/epcr/${encodeURIComponent(row.id)}`}>Open Report</Link></td>
      </tr>)}</tbody>
    </table></div>
    {rows.length === size && <button className="rounded-lg border px-4 py-2" onClick={() => setSize(size + 50)}>Load More</button>}
    <p className="text-sm text-slate-600">Existing reports without a review record require the separate historical audit; they are not automatically approved.</p>
  </main>;
}
