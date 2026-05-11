"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import PermissionGuard from "@/app/components/PermissionGuard";

type Project = {
  id: string;
  projectName?: string;
  client?: string;
  status?: string;
};

export default function ClientNewCasePage() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [saving, setSaving] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [callerName, setCallerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [googleMapsLink, setGoogleMapsLink] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (userLoading) return;

    if (!user?.uid) {
      setLoadingProjects(false);
      return;
    }

    const q = query(
      collection(db, "projects"),
      where("clientUserIds", "array-contains", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setProjects(list);
        setLoadingProjects(false);
      },
      (error) => {
        console.error("Load client projects error:", error);
        setLoadingProjects(false);
      }
    );

    return () => unsub();
  }, [user?.uid, userLoading]);

  const selectedProject = projects.find((p) => p.id === projectId);

  const submitCase = async () => {
    if (!user?.uid) {
      alert("User is missing.");
      return;
    }

    if (!projectId) {
      alert("Please select a project.");
      return;
    }

    if (!callerName.trim() || !contactNumber.trim() || !chiefComplaint.trim()) {
      alert("Caller name, contact number, and chief complaint are required.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "cases"), {
        projectId,
        projectName: selectedProject?.projectName || selectedProject?.client || "",

        callerName: callerName.trim(),
        contactNumber: contactNumber.trim(),
        patientName: patientName.trim(),
        chiefComplaint: chiefComplaint.trim(),

        locationDescription: locationDescription.trim(),
        googleMapsLink: googleMapsLink.trim(),
        notes: notes.trim(),

        status: "Received",
        source: "client_portal",
        createdByRole: "client",
        createdByUid: user.uid,
        clientId: user.uid,
        requiresDispatchReview: true,

        timeline: {
          Received: serverTimestamp(),
        },

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      alert("Case submitted successfully.");
      router.push("/client/cases");
    } catch (error) {
      console.error("Create client case error:", error);
      alert("Failed to submit case.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-[#0b1220] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500";

  const labelClass = "mb-1.5 block text-xs font-medium text-slate-300";

  if (userLoading || loadingProjects) {
    return <div className="p-6 text-slate-400">Loading...</div>;
  }

  return (
    <PermissionGuard module="client_cases" action="create" showMessage={true}>
      <div className="min-h-screen bg-[#030712] p-6 text-white">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Create New Case</h1>
          <p className="mt-1 text-sm text-slate-400">
            Submit a new request to the dispatch team.
          </p>
        </div>

        <div className="max-w-4xl rounded-2xl border border-slate-800 bg-[#111827] p-5">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
              No assigned projects found. Please contact Lazem team.
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName || p.client || p.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Caller Name</label>
                  <input
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    className={inputClass}
                    placeholder="Caller name"
                  />
                </div>

                <div>
                  <label className={labelClass}>Contact Number</label>
                  <input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className={inputClass}
                    placeholder="05xxxxxxxx"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Patient Name</label>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className={labelClass}>Chief Complaint</label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className={`${inputClass} min-h-[100px]`}
                  placeholder="Briefly describe the case"
                />
              </div>

              <div>
                <label className={labelClass}>Location Description</label>
                <textarea
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                  className={`${inputClass} min-h-[90px]`}
                  placeholder="Building, gate, area, landmark..."
                />
              </div>

              <div>
                <label className={labelClass}>Google Maps Link</label>
                <input
                  value={googleMapsLink}
                  onChange={(e) => setGoogleMapsLink(e.target.value)}
                  className={inputClass}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputClass} min-h-[90px]`}
                  placeholder="Additional notes"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={submitCase}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Submitting..." : "Submit Case"}
                </button>

                <button
                  type="button"
                  onClick={() => router.back()}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}