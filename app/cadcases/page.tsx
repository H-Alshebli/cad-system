"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  Activity,
  BriefcaseMedical,
  Filter,
  Search,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import {
  getCaseDisplayCode,
  getCaseDisplayTitle,
  getProjectDisplayName,
  getUnitDisplayName,
} from "@/lib/displayLabels";

function getCaseDate(item: any): Date | null {
  const raw =
    item.timeline?.receivedAt ||
    item.timeline?.Received ||
    item.createdAt ||
    item.created_at ||
    item.requestedAt ||
    null;

  const date = raw?.toDate?.() || (raw ? new Date(raw) : null);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatCaseDate(item: any) {
  const date = getCaseDate(item);
  if (!date) return "—";

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getCaseLocation(item: any) {
  return (
    item.location?.text ||
    item.locationText ||
    item.pickup?.text ||
    item.pickupText ||
    item.pickupLocation?.text ||
    "—"
  );
}

function statusClasses(status: string) {
  switch (status) {
    case "Closed":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "OnScene":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "Transporting":
    case "Hospital":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "Returning":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "EnRoute":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

export default function ModernCadCasesPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const { can, loading: permissionLoading } = usePermissions(user?.role);
  const [cases, setCases] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("current");
  const canViewAll = can("cad_cases_new", "view_all");
  const canViewAssigned = can("cad_cases_new", "view_assigned");
  const assignedOnly = !canViewAll && canViewAssigned;

  useEffect(() => {
    if (userLoading || permissionLoading) return;
    if (!canViewAll && (!canViewAssigned || !user?.uid)) {
      setCases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const caseUnsubscribers: Array<() => void> = [];
    const handleError = (error: unknown) => {
      console.error("Modern CAD cases listener failed", error);
      setLoading(false);
    };

    if (canViewAll) {
      caseUnsubscribers.push(
        onSnapshot(
          collection(db, "cases"),
          (snapshot) => {
            setCases(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
            setLoading(false);
          },
          handleError
        )
      );
    } else {
      const snapshots = new Map<string, Map<string, any>>();
      const publish = () => {
        const merged = new Map<string, any>();
        snapshots.forEach((items) => items.forEach((item, id) => merged.set(id, item)));
        setCases(Array.from(merged.values()));
        setLoading(false);
      };
      (["participantUserIds", "assignedUserIds"] as const).forEach((field) => {
        caseUnsubscribers.push(
          onSnapshot(
            query(collection(db, "cases"), where(field, "array-contains", user!.uid)),
            (snapshot) => {
              snapshots.set(
                field,
                new Map(snapshot.docs.map((item) => [item.id, { id: item.id, ...item.data() }]))
              );
              publish();
            },
            handleError
          )
        );
      });
    }

    const unsubscribeProjects = onSnapshot(
      collection(db, "projects"),
      (snapshot) => {
        setProjects(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        );
      },
      (error) => console.error("CAD projects listener failed", error)
    );

    return () => {
      caseUnsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribeProjects();
    };
  }, [canViewAll, canViewAssigned, permissionLoading, user?.uid, userLoading]);

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const projectOptions = useMemo(
    () =>
      [...projects]
        .filter((project) => project.isArchived !== true && project.archived !== true)
        .sort((a, b) =>
          getProjectDisplayName(a).localeCompare(getProjectDisplayName(b))
        ),
    [projects]
  );

  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(cases.map((item) => String(item.status || "Unknown")))
      ).sort(),
    [cases]
  );

  const visibleCases = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return [...cases]
      .filter((item) => {
        const project = projectMap.get(item.projectId);
        const projectName =
          item.projectName ||
          (project ? getProjectDisplayName(project) : "Unassigned / B2C");

        if (projectFilter !== "all" && item.projectId !== projectFilter) {
          return false;
        }

        if (statusFilter === "current" && item.status === "Closed") {
          return false;
        }

        if (
          statusFilter !== "all" &&
          statusFilter !== "current" &&
          String(item.status || "Unknown") !== statusFilter
        ) {
          return false;
        }

        if (!needle) return true;

        return [
          item.id,
          item.caseNumber,
          item.caseSequence,
          item.externalReference,
          getCaseDisplayCode(item),
          getCaseDisplayTitle(item),
          projectName,
          item.patientName,
          item.patient?.name,
          item.chiefComplaint,
          item.status,
          getUnitDisplayName(item.assignedUnit),
        ].some((value) => String(value || "").toLowerCase().includes(needle));
      })
      .sort(
        (a, b) =>
          (getCaseDate(b)?.getTime() || 0) - (getCaseDate(a)?.getTime() || 0)
      );
  }, [cases, projectFilter, projectMap, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: cases.length,
      active: cases.filter((item) => item.status !== "Closed").length,
      onScene: cases.filter((item) => item.status === "OnScene").length,
      transporting: cases.filter((item) =>
        ["Transporting", "Hospital"].includes(item.status)
      ).length,
    }),
    [cases]
  );

  return (
    <div className="page-shell space-y-5">
      <div className="page-header">
        <div>
          <span className="badge">Modern CAD Workspace</span>
          <h1 className="page-title mt-3">{assignedOnly ? "My CAD Cases" : "CAD Cases"}</h1>
          <p className="page-subtitle">
            {assignedOnly
              ? "Cases currently or previously assigned to you."
              : "All project and B2C cases in one modern operational workspace."}
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#274C5A] text-white shadow-lg shadow-[#274C5A]/15">
          <BriefcaseMedical size={26} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total Cases", stats.total],
          ["Active", stats.active],
          ["OnScene", stats.onScene],
          ["Transporting", stats.transporting],
        ].map(([label, value]) => (
          <div key={label} className="card-modern p-4">
            <p className="text-xs font-bold text-[#607482]">{label}</p>
            <p className="mt-1 text-2xl font-black text-[#274C5A]">{value}</p>
          </div>
        ))}
      </div>

      <div className="card-modern space-y-3">
        <div className="flex items-center gap-2 text-sm font-black text-[#123746]">
          <Filter size={17} /> Filters
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#607482]"
            />
            <input
              className="input w-full pl-11"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search case, patient, project, complaint, or unit"
            />
          </div>

          <select
            className="select w-full"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="all">All Projects</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {getProjectDisplayName(project)}
              </option>
            ))}
          </select>

          <select
            className="select w-full"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="current">Current Cases</option>
            <option value="all">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#274C5A]">
            {assignedOnly ? "My Assigned Cases" : "All Cases"}
          </h2>
          <p className="text-sm font-semibold text-[#607482]">
            Showing {visibleCases.length} of {cases.length} cases
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card-modern text-sm font-semibold text-[#607482]">
          Loading CAD cases...
        </div>
      ) : visibleCases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#86A7B2]/40 bg-white p-8 text-center text-sm font-semibold text-[#607482]">
          No cases match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {visibleCases.map((item) => {
            const project = projectMap.get(item.projectId);
            const projectName =
              item.projectName ||
              (project ? getProjectDisplayName(project) : "Unassigned / B2C");
            const unitName = getUnitDisplayName(item.assignedUnit) || "Unassigned";
            const status = String(item.status || "Unknown");
            const chiefComplaint =
              item.chiefComplaint ||
              item.caseInfo?.complaint ||
              item.complaint ||
              item.serviceType ||
              "—";
            const location = getCaseLocation(item);

            return (
              <Link
                key={item.id}
                href={`/cadcases/${item.id}`}
                className="group rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5 transition hover:-translate-y-0.5 hover:border-[#74cdda] hover:shadow-lg hover:shadow-[#274C5A]/10"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xl font-black text-[#123746]">
                      {getCaseDisplayCode(item)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm font-bold text-[#274C5A]">
                      {getCaseDisplayTitle(item)}
                    </div>
                    <div className="mt-2 text-sm font-medium text-[#607482]">
                      Date &amp; Time: {formatCaseDate(item)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasses(
                      status
                    )}`}
                  >
                    {status}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7F7F7F]">
                      Chief Complaint
                    </div>
                    <div className="mt-1 font-black text-[#123746]">
                      {chiefComplaint}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7F7F7F]">
                      Project Name
                    </div>
                    <div className="mt-1 font-black text-[#123746]">
                      {projectName}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7F7F7F]">
                      Location
                    </div>
                    <div className="mt-1 line-clamp-2 font-black text-[#123746]">
                      {location}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7F7F7F]">
                      Assigned Unit
                    </div>
                    <div className="mt-1 font-black text-[#123746]">
                      {unitName}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 border-t border-[#e1ebef] pt-4 text-sm font-black text-[#166575]">
                  <Activity size={16} /> Open case details →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
