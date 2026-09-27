"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PermissionGuard from "@/app/components/PermissionGuard";
import { db } from "@/lib/firebase";
import { createManualEpcr } from "@/lib/epcr";
import { useCurrentUser } from "@/lib/useCurrentUser";

function projectName(project: any) {
  return project?.projectName || project?.name || project?.title || project?.id || "Project";
}

function unitCode(unit: any) {
  return unit?.code || unit?.unitCode || unit?.ambulanceCode || unit?.name || unit?.id || "Unit";
}

export default function ManualEpcrPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [projects, setProjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  useEffect(() => {
    const unsubProjects = onSnapshot(collection(db, "projects"), (snapshot) => {
      setProjects(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
    const unsubUnits = onSnapshot(collection(db, "ambulances"), (snapshot) => {
      setUnits(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item: any) => item.archived !== true)
      );
    });
    return () => {
      unsubProjects();
      unsubUnits();
    };
  }, []);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => projectName(a).localeCompare(projectName(b))),
    [projects]
  );
  const projectUnits = useMemo(
    () =>
      [...units]
        .filter((unit) => {
          const linkedProjectId = unit.assignedProjectId || unit.projectId || "";
          return !selectedProjectId || !linkedProjectId || linkedProjectId === selectedProjectId;
        })
        .sort((a, b) => unitCode(a).localeCompare(unitCode(b))),
    [selectedProjectId, units]
  );

  async function startManualEpcr() {
    if (creatingRef.current) return;
    const selectedProject = projects.find((item) => item.id === selectedProjectId);
    if (!selectedProject || !user?.uid) {
      alert("Select a project before starting the manual ePCR.");
      return;
    }

    const selectedUnit = units.find((item) => item.id === selectedUnitId);
    creatingRef.current = true;
    setCreating(true);
    try {
      // Keep only an opaque request token, never patient data. Retain on error
      // or reload so an uncertain successful commit cannot create a second case.
      const storageKey = `hcad-manual-request:${user.uid}:${selectedProjectId}:${selectedUnitId}`;
      const requestId = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, requestId);
      const epcrId = await createManualEpcr({
        requestId,
        projectId: selectedProject.id,
        projectName: projectName(selectedProject),
        unitId: selectedUnit?.id,
        unitCode: selectedUnit ? unitCode(selectedUnit) : "",
        createdBy: user.uid,
        createdByName: user.name || user.displayName || user.email || user.uid,
      });
      sessionStorage.removeItem(storageKey);
      router.push(`/epcr/${epcrId}`);
    } catch (error: any) {
      console.error("Failed to create manual ePCR", error);
      alert(error?.message || "Failed to create manual ePCR.");
      setCreating(false);
      creatingRef.current = false;
    }
  }

  return (
    <PermissionGuard module="missions" action="view" showMessage>
      <div className="page-shell max-w-4xl">
        <div className="page-header">
          <div>
            <span className="badge">Manual clinical record</span>
            <h1 className="page-title mt-3">Manual ePCR</h1>
            <p className="page-subtitle">
              Start an on-scene patient care report. A linked CAD case will be
              created automatically for Dispatch monitoring and status updates.
            </p>
          </div>
          <Link className="btn-secondary" href="/missions-plus">Back to My Missions+</Link>
        </div>

        <div className="card-modern space-y-5">
          <div>
            <label className="mb-2 block text-sm font-black text-[#123746]">Project *</label>
            <select
              className="select w-full"
              value={selectedProjectId}
              onChange={(event) => {
                setSelectedProjectId(event.target.value);
                setSelectedUnitId("");
              }}
            >
              <option value="">Select project</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>{projectName(project)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black text-[#123746]">Unit / Ambulance</label>
            <select
              className="select w-full"
              value={selectedUnitId}
              onChange={(event) => setSelectedUnitId(event.target.value)}
            >
              <option value="">No unit selected</option>
              {projectUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{unitCode(unit)}</option>
              ))}
            </select>
            <p className="mt-2 text-xs font-semibold text-[#607482]">
              Selecting a unit is optional. The project is always required for reporting.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            This creates a linked CAD case and ePCR. Do not start another report for the same event.
          </div>

          <button
            type="button"
            className="btn-primary min-h-[52px] w-full justify-center"
            disabled={creating || !selectedProjectId}
            onClick={startManualEpcr}
          >
            {creating ? "Creating ePCR..." : "Start Manual ePCR"}
          </button>
        </div>
      </div>
    </PermissionGuard>
  );
}
