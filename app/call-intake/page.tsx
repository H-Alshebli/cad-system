"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  BriefcaseMedical,
  ClipboardPlus,
  Headphones,
  UserRound,
  ArrowRight,
  Search,
  FolderKanban,
  Ambulance,
} from "lucide-react";

import { db } from "@/lib/firebase";

export default function CallIntakePage() {
  const router = useRouter();

  const [caseType, setCaseType] = useState<"project" | "b2c" | "">("");
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p: any) => p.archived !== true && p.isArchived !== true)
        .sort((a: any, b: any) =>
          String(a.projectName || a.name || a.title || "").localeCompare(
            String(b.projectName || b.name || b.title || "")
          )
        );

      setProjects(list);
    });

    return () => unsub();
  }, []);

  function continueFlow() {
    if (caseType === "project") {
      if (!projectId) {
        alert("Please select a project first.");
        return;
      }

      router.push(`/projects/${projectId}/cases/new`);
      return;
    }

    if (caseType === "b2c") {
      router.push("/b2c/cases/new");
      return;
    }

    alert("Please select the request type.");
  }

  const selectedProject = projects.find((p) => p.id === projectId);

  return (
    <main className="min-h-screen bg-[#f3f8fa] px-4 py-5 text-[#123746] lg:px-6">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-[#d8e6ea] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#274C5A] text-white shadow-lg shadow-[#274C5A]/15">
                <Headphones size={26} />
              </div>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#b9ecf2] bg-[#effbfc] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#166575]">
                  <ClipboardPlus size={14} />
                  Dispatch Intake
                </div>

                <h1 className="text-3xl font-black tracking-tight text-[#123746]">
                  New Case / Call Intake
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#607482]">
                  Dispatcher starts every new call from here. Select whether
                  the call belongs to an existing project or a B2C customer,
                  then continue to the right case form.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/cases")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#c8dce2] bg-white px-5 text-sm font-bold text-[#274C5A] transition hover:border-[#74cdda] hover:bg-[#f7fbfc]"
            >
              <Ambulance size={18} />
              Open CAD Cases
            </button>
          </div>
        </div>

        {/* Choice Cards */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <button
            type="button"
            onClick={() => setCaseType("project")}
            className={`group rounded-3xl border p-6 text-left shadow-sm transition ${
              caseType === "project"
                ? "border-[#274C5A] bg-[#effbfc] ring-4 ring-[#74cdda]/20"
                : "border-[#d8e6ea] bg-white hover:border-[#74cdda] hover:bg-[#f7fbfc]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#b9ecf2] bg-[#effbfc] text-[#166575]">
                <FolderKanban size={26} />
              </div>

              <div className="rounded-full border border-[#b9ecf2] bg-[#effbfc] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#166575]">
                B2B / B2G
              </div>
            </div>

            <h2 className="mt-6 text-2xl font-black text-[#123746]">
              Existing Project
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#607482]">
              Use the current project case page. The created case will be linked
              to the selected project and will still become a unified CAD case.
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-bold text-[#166575]">
              <span>Select project path</span>
              <ArrowRight
                size={16}
                className="transition group-hover:translate-x-1"
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCaseType("b2c")}
            className={`group rounded-3xl border p-6 text-left shadow-sm transition ${
              caseType === "b2c"
                ? "border-[#137a4a] bg-[#dff8ed] ring-4 ring-[#137a4a]/10"
                : "border-[#d8e6ea] bg-white hover:border-[#137a4a] hover:bg-[#f5fcf8]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#137a4a]/20 bg-[#dff8ed] text-[#137a4a]">
                <UserRound size={26} />
              </div>

              <div className="rounded-full border border-[#137a4a]/20 bg-[#dff8ed] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#137a4a]">
                Individual Customer
              </div>
            </div>

            <h2 className="mt-6 text-2xl font-black text-[#123746]">
              B2C Customer
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#607482]">
              Register customer details, service information, pickup and
              destination, confirm payment, then dispatch the assigned team.
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-bold text-[#137a4a]">
              <span>Open B2C intake</span>
              <ArrowRight
                size={16}
                className="transition group-hover:translate-x-1"
              />
            </div>
          </button>
        </div>

        {/* Project Path */}
        {caseType === "project" && (
          <div className="rounded-3xl border border-[#d8e6ea] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#b9ecf2] bg-[#effbfc] text-[#166575]">
                <BriefcaseMedical size={22} />
              </div>

              <div>
                <h3 className="text-xl font-black text-[#123746]">
                  Select Project
                </h3>
                <p className="mt-1 text-sm text-[#607482]">
                  Choose the existing project before opening the project case
                  form.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <select
                  className="h-13 w-full rounded-2xl border border-[#c8dce2] bg-[#f7fbfc] py-3 pl-12 pr-4 text-sm font-semibold text-[#123746] outline-none transition focus:border-[#74cdda] focus:ring-4 focus:ring-[#74cdda]/20"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">Choose existing project</option>

                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName || p.name || p.title || p.clientName || p.id}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={continueFlow}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-[#274C5A] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#274C5A]/15 transition hover:bg-[#1d3b47] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open Project Case Form
                <ArrowRight size={18} />
              </button>
            </div>

            {selectedProject && (
              <div className="mt-5 rounded-2xl border border-[#d8e6ea] bg-[#f7fbfc] p-4">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Selected Project
                </div>

                <div className="mt-1 text-base font-black text-[#123746]">
                  {selectedProject.projectName ||
                    selectedProject.name ||
                    selectedProject.title ||
                    selectedProject.clientName ||
                    selectedProject.id}
                </div>

                {selectedProject.clientName && (
                  <div className="mt-1 text-sm text-[#607482]">
                    Client: {selectedProject.clientName}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* B2C Path */}
        {caseType === "b2c" && (
          <div className="rounded-3xl border border-[#d8e6ea] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#137a4a]/20 bg-[#dff8ed] text-[#137a4a]">
                  <UserRound size={22} />
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#123746]">
                    B2C Intake
                  </h3>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[#607482]">
                    Open the B2C request form, register the customer and patient
                    details, then confirm payment before dispatch assignment.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={continueFlow}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#137a4a] px-6 text-sm font-black text-white shadow-lg shadow-[#137a4a]/15 transition hover:bg-[#0f633c]"
              >
                Open B2C Form
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

