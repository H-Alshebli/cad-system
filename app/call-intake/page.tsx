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
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 dark:bg-[#020817] dark:text-white lg:px-6">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-950/20">
                <Headphones size={26} />
              </div>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  <ClipboardPlus size={14} />
                  Dispatch Intake
                </div>

                <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  New Case / Call Intake
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Dispatcher starts every new call from here. Select whether
                  the call belongs to an existing project or a B2C customer,
                  then continue to the right case form.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/cases")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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
                ? "border-blue-500 bg-blue-500/10 ring-4 ring-blue-500/10 dark:border-blue-400"
                : "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-blue-500/70 dark:hover:bg-blue-500/5"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                <FolderKanban size={26} />
              </div>

              <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                B2B / B2G
              </div>
            </div>

            <h2 className="mt-6 text-2xl font-black text-slate-950 dark:text-white">
              Existing Project
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Use the current project case page. The created case will be linked
              to the selected project and will still become a unified CAD case.
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
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
                ? "border-emerald-500 bg-emerald-500/10 ring-4 ring-emerald-500/10 dark:border-emerald-400"
                : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-emerald-500/70 dark:hover:bg-emerald-500/5"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <UserRound size={26} />
              </div>

              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Individual Customer
              </div>
            </div>

            <h2 className="mt-6 text-2xl font-black text-slate-950 dark:text-white">
              B2C Customer
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Register customer details, service information, pickup and
              destination, confirm payment, then dispatch the assigned team.
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
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
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                <BriefcaseMedical size={22} />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-950 dark:text-white">
                  Select Project
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Choose the existing project before opening the project case
                  form.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <select
                  className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open Project Case Form
                <ArrowRight size={18} />
              </button>
            </div>

            {selectedProject && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Selected Project
                </div>

                <div className="mt-1 text-base font-black text-slate-950 dark:text-white">
                  {selectedProject.projectName ||
                    selectedProject.name ||
                    selectedProject.title ||
                    selectedProject.clientName ||
                    selectedProject.id}
                </div>

                {selectedProject.clientName && (
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Client: {selectedProject.clientName}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* B2C Path */}
        {caseType === "b2c" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <UserRound size={22} />
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-950 dark:text-white">
                    B2C Intake
                  </h3>

                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Open the B2C request form, register the customer and patient
                    details, then confirm payment before dispatch assignment.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={continueFlow}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-700"
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