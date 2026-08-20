"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import PermissionGuard from "@/app/components/PermissionGuard";
import { auth, db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { getProjectDisplayName } from "@/lib/displayLabels";
import {
  CREW_PROFILE_FIELDS,
  CREW_PROFILE_SECTIONS,
  CrewProfileAttachments,
  CrewProfileValues,
  getCrewAttachmentStatus,
  getCrewProfileCompletion,
  getCrewProfileRequirementMode,
  getCrewProfileValues,
} from "@/lib/crewProfile";

type CrewUser = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
  crewProfile?: Record<string, string>;
  crewProfileAttachments?: CrewProfileAttachments;
  profileUpdatedAt?: any;
  crewProfileReviewStatus?: string;
  crewProfileReviewNotes?: string;
  crewProfileUpdateRequestReason?: string;
};

type CrewProject = {
  id: string;
  projectName?: string;
  name?: string;
  isArchived?: boolean;
  assignedUsers?: Record<string, boolean>;
  assignedUserIds?: string[];
  teamUserIds?: string[];
  assignedAmbulances?: Array<{
    crewUserIds?: string[];
    crewMembers?: Array<{ userId?: string }>;
  }>;
  projectDetails?: {
    siteDetails?: string;
    eventLocation?: string;
  };
};

const fileFieldKeys = new Set(
  CREW_PROFILE_FIELDS.filter((field) => field.type === "file").map((field) => field.key)
);

function profileName(user: CrewUser, values: CrewProfileValues) {
  const fullNameEn = [
    values.firstNameEn,
    values.secondNameEn,
    values.thirdNameEn,
    values.familyNameEn,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const fullNameAr = [
    values.firstNameAr,
    values.secondNameAr,
    values.thirdNameAr,
    values.familyNameAr,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullNameEn || fullNameAr || user.name || user.email || "Crew Member";
}

function formatDate(value: any) {
  if (!value) return "-";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function complianceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    compliant: "Compliant",
    incomplete: "Incomplete",
    pending_verification: "Pending Verification",
    expiring_soon: "Expiring Soon",
    expired: "Expired",
    rejected: "Rejected",
  };
  return labels[status] || status;
}

function statusClass(status: string) {
  if (status === "compliant") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }
  if (status === "expiring_soon" || status === "pending_verification") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }
  return "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-200";
}

function isCrewProfileUser(user: CrewUser, values: CrewProfileValues) {
  if (String(values.jobTitle || "").trim()) return true;
  if (Object.values(user.crewProfile || {}).some((value) => String(value || "").trim())) {
    return true;
  }
  if (Object.keys(user.crewProfileAttachments || {}).length > 0) return true;

  const role = String(user.role || "").toLowerCase();
  return /crew|paramedic|emt|nurse|physician|doctor|ambulance|driver|dispatcher|ccc|medical[_ ]team/.test(
    role
  );
}

function getProjectAssignedUserIds(project: CrewProject) {
  const ids = new Set<string>();
  Object.entries(project.assignedUsers || {}).forEach(([id, assigned]) => {
    if (assigned) ids.add(id);
  });
  (project.assignedUserIds || []).forEach((id) => ids.add(id));
  (project.teamUserIds || []).forEach((id) => ids.add(id));
  (project.assignedAmbulances || []).forEach((ambulance) => {
    (ambulance.crewUserIds || []).forEach((id) => ids.add(id));
    (ambulance.crewMembers || []).forEach((member) => {
      if (member.userId) ids.add(member.userId);
    });
  });
  return ids;
}

function fieldDisplayValue(fieldKey: string, values: CrewProfileValues, attachments: Record<string, any>) {
  if (fileFieldKeys.has(fieldKey)) {
    return attachments?.[fieldKey]?.name || "";
  }

  const rawValue = values[fieldKey] || "";
  if (fieldKey === "coverageCitiesWithin48h") {
    try {
      const cities = JSON.parse(rawValue);
      return Array.isArray(cities) ? cities.join(", ") : rawValue;
    } catch {
      return rawValue;
    }
  }
  if (fieldKey === "availableWeekDays") {
    try {
      const availability = JSON.parse(rawValue);
      return Object.entries(availability)
        .map(([day, hours]: [string, any]) =>
          `${day}: ${hours?.from || "-"} - ${hours?.to || "-"}`
        )
        .join(", ");
    } catch {
      return rawValue;
    }
  }

  return rawValue;
}

function todayFileStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function contractDaysLabel(value: string) {
  if (!value) return "No end date";
  const end = new Date(`${value}T00:00:00`);
  if (Number.isNaN(end.getTime())) return "Invalid date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Ends today";
  return `${days} days left`;
}

export default function CrewProfilesDashboardPage() {
  const { user: reviewer } = useCurrentUser();
  const { can, isAdmin } = usePermissions(reviewer?.role);
  const [users, setUsers] = useState<CrewUser[]>([]);
  const [projects, setProjects] = useState<CrewProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [jobTitleFilter, setJobTitleFilter] = useState("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [reviewingAttachment, setReviewingAttachment] = useState("");
  const [reviewingProfile, setReviewingProfile] = useState(false);
  const canReviewAttachments =
    isAdmin || can("crew_profile", "edit_all");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs
          .map((item) => ({ id: item.id, ...(item.data() as any) }))
          .sort((a, b) => String(a.name || a.email || "").localeCompare(String(b.name || b.email || "")));

        setUsers(list);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load crew profiles", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    return onSnapshot(
      collection(db, "projects"),
      (snap) => {
        setProjects(
          snap.docs
            .map((item) => ({ id: item.id, ...(item.data() as any) }))
            .filter((project) => !project.isArchived)
            .sort((a, b) =>
              getProjectDisplayName(a).localeCompare(getProjectDisplayName(b))
            )
        );
      },
      (error) => console.error("Failed to load projects for crew compliance", error)
    );
  }, []);

  const rows = useMemo(() => {
    return users.map((user) => {
      const values = getCrewProfileValues(user);
      const attachments = user.crewProfileAttachments || {};
      const completion = getCrewProfileCompletion(
        values,
        attachments,
        getCrewProfileRequirementMode(user)
      );
      const attachmentCount = Object.values(attachments).filter(Boolean).length;

      const projectIds = projects
        .filter(
          (project) =>
            values.primaryProjectId === project.id ||
            getProjectAssignedUserIds(project).has(user.id)
        )
        .map((project) => project.id);

      return {
        user,
        values,
        completion,
        attachmentCount,
        displayName: profileName(user, values),
        projectIds,
        projectNames: projects
          .filter((project) => projectIds.includes(project.id))
          .map((project) => getProjectDisplayName(project)),
      };
    }).filter((row) => isCrewProfileUser(row.user, row.values));
  }, [users, projects]);

  const stats = useMemo(() => {
    const compliant = rows.filter(
      (row) => row.completion.complianceStatus === "compliant"
    ).length;
    const attention = rows.length - compliant;
    const expired = rows.filter(
      (row) => row.completion.complianceStatus === "expired"
    ).length;

    return {
      total: rows.length,
      compliant,
      attention,
      expired,
    };
  }, [rows]);

  const filterOptions = useMemo(
    () => ({
      jobTitles: Array.from(
        new Set(rows.map((row) => row.values.jobTitle).filter(Boolean))
      ).sort(),
      employmentTypes: Array.from(
        new Set(rows.map((row) => row.values.employmentType).filter(Boolean))
      ).sort(),
      locations: Array.from(
        new Set(rows.map((row) => row.values.workLocation).filter(Boolean))
      ).sort(),
      supervisors: Array.from(
        new Set(rows.map((row) => row.values.supervisorName).filter(Boolean))
      ).sort(),
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const haystack = [
        row.displayName,
        row.user.email,
        row.user.role,
        row.values.employeeId,
        row.values.mobile,
        row.values.city,
        row.values.jobTitle,
        row.values.employmentType,
        row.values.workLocation,
        row.values.supervisorName,
        ...row.projectNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || haystack.includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        row.completion.complianceStatus === statusFilter;
      const matchesJobTitle =
        jobTitleFilter === "all" || row.values.jobTitle === jobTitleFilter;
      const matchesEmploymentType =
        employmentTypeFilter === "all" ||
        row.values.employmentType === employmentTypeFilter;
      const matchesProject =
        projectFilter === "all" ||
        (projectFilter === "unassigned"
          ? row.projectIds.length === 0
          : row.projectIds.includes(projectFilter));
      const matchesLocation =
        locationFilter === "all" || row.values.workLocation === locationFilter;
      const matchesSupervisor =
        supervisorFilter === "all" ||
        row.values.supervisorName === supervisorFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesJobTitle &&
        matchesEmploymentType &&
        matchesProject &&
        matchesLocation &&
        matchesSupervisor
      );
    });
  }, [
    rows,
    search,
    statusFilter,
    jobTitleFilter,
    employmentTypeFilter,
    projectFilter,
    locationFilter,
    supervisorFilter,
  ]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    jobTitleFilter !== "all" ||
    employmentTypeFilter !== "all" ||
    projectFilter !== "all" ||
    locationFilter !== "all" ||
    supervisorFilter !== "all";

  const projectCompliance = useMemo(() => {
    const summaries = projects.map((project) => {
      const projectRows = rows.filter((row) => row.projectIds.includes(project.id));
      const compliant = projectRows.filter(
        (row) => row.completion.complianceStatus === "compliant"
      ).length;
      return {
        id: project.id,
        name: getProjectDisplayName(project),
        site:
          project.projectDetails?.siteDetails ||
          project.projectDetails?.eventLocation ||
          "-",
        total: projectRows.length,
        compliant,
        attention: projectRows.length - compliant,
        percent: projectRows.length
          ? Math.round((compliant / projectRows.length) * 100)
          : 0,
      };
    });
    const unassignedRows = rows.filter((row) => row.projectIds.length === 0);
    const unassignedCompliant = unassignedRows.filter(
      (row) => row.completion.complianceStatus === "compliant"
    ).length;

    return [
      ...summaries,
      {
        id: "unassigned",
        name: "Unassigned Crew",
        site: "-",
        total: unassignedRows.length,
        compliant: unassignedCompliant,
        attention: unassignedRows.length - unassignedCompliant,
        percent: unassignedRows.length
          ? Math.round((unassignedCompliant / unassignedRows.length) * 100)
          : 0,
      },
    ];
  }, [projects, rows]);

  const selectedRow = rows.find((row) => row.user.id === selectedId);

  async function reviewAttachment(
    targetUser: CrewUser,
    fieldKey: string,
    decision: "verified" | "rejected"
  ) {
    if (!reviewer?.uid || !canReviewAttachments) return;

    const existing = targetUser.crewProfileAttachments?.[fieldKey];
    if (!existing?.url) return;

    const reason =
      decision === "rejected"
        ? window.prompt("Enter the rejection reason. The crew member will see it:")
        : "";
    if (decision === "rejected" && !String(reason || "").trim()) return;

    const reviewKey = `${targetUser.id}:${fieldKey}`;
    setReviewingAttachment(reviewKey);

    try {
      const reviewedAt = new Date().toISOString();
      const actorName =
        reviewer.name || reviewer.displayName || reviewer.email || "Reviewer";
      const nextAttachment = {
        name: existing.name || "",
        url: existing.url,
        path: existing.path || "",
        contentType: existing.contentType || "application/octet-stream",
        size: existing.size || 0,
        uploadedAt: existing.uploadedAt || "",
        uploadedById: existing.uploadedById || "",
        uploadedByName: existing.uploadedByName || "",
        status: decision,
        reviewedAt,
        reviewerId: reviewer.uid,
        reviewerName: actorName,
        reviewerEmail: reviewer.email || "",
        ...(decision === "rejected"
          ? { rejectionReason: String(reason).trim() }
          : {}),
        verificationHistory: [
          ...(existing.verificationHistory || []),
          {
            action: decision,
            at: reviewedAt,
            actorId: reviewer.uid,
            actorName,
            actorEmail: reviewer.email || "",
            ...(decision === "rejected"
              ? { reason: String(reason).trim() }
              : {}),
          },
        ],
      };
      const nextAttachments = {
        ...(targetUser.crewProfileAttachments || {}),
        [fieldKey]: nextAttachment,
      };
      const values = getCrewProfileValues({
        ...targetUser,
        crewProfileAttachments: nextAttachments,
      });
      const completion = getCrewProfileCompletion(
        values,
        nextAttachments,
        getCrewProfileRequirementMode(targetUser)
      );

      await updateDoc(doc(db, "users", targetUser.id), {
        crewProfileAttachments: nextAttachments,
        crewProfileCompletion: completion.percent,
        crewProfileMissingFields: completion.missing.map((field) => field.key),
        crewProfilePendingVerificationFields: completion.pendingVerification.map(
          (field) => field.key
        ),
        crewProfileRejectedFields: completion.rejected.map((field) => field.key),
        crewProfileExpiredFields: completion.expired.map((field) => field.key),
        crewProfileExpiringSoonFields: completion.expiringSoon.map(
          (field) => field.key
        ),
        crewProfileStatus: completion.status,
        crewProfileComplianceStatus: completion.complianceStatus,
        crewProfileIsComplete: completion.isComplete,
        crewProfileIsCompliant: completion.isCompliant,
        profileUpdatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to review crew attachment", error);
      window.alert("Could not update the document status. Please try again.");
    } finally {
      setReviewingAttachment("");
    }
  }

  async function reviewProfile(
    targetUser: CrewUser,
    action: "verify" | "request_changes" | "reopen" | "reject_update"
  ) {
    if (!reviewer?.uid || !canReviewAttachments) return;
    const notes =
      action === "request_changes"
        ? window.prompt("Enter the changes required from the employee:")
        : action === "reject_update"
        ? window.prompt("Optional reason for rejecting the update request:") || ""
        : "";
    if (action === "request_changes" && !String(notes || "").trim()) return;

    setReviewingProfile(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/crew-profile/review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: targetUser.id, action, notes }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not review the profile.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not review the profile.");
    } finally {
      setReviewingProfile(false);
    }
  }

  async function updateContractEndDate(targetUser: CrewUser) {
    const currentValue = getCrewProfileValues(targetUser).contractEndDate || "";
    const contractEndDate = window.prompt(
      "Enter the contract end date as YYYY-MM-DD. Leave blank to remove it:",
      currentValue
    );
    if (contractEndDate === null) return;

    setReviewingProfile(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/crew-profile/review", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: targetUser.id,
          action: "update_contract",
          contractEndDate,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update the contract date.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update the contract date.");
    } finally {
      setReviewingProfile(false);
    }
  }

  function exportToExcel() {
    const exportRows = filteredRows.map((row) => {
      const attachments = row.user.crewProfileAttachments || {};
      const base: Record<string, string | number> = {
        "Crew Member": row.displayName,
        Email: row.user.email || "",
        "System Role": row.user.role || "",
        Active: row.user.active === false ? "No" : "Yes",
        "Employee ID": row.values.employeeId || "",
        "Mobile Country Code": row.values.mobileCountryCode || "",
        "Mobile Number": row.values.mobile || "",
        City: row.values.city || "",
        "Work Location": row.values.workLocation || "",
        Supervisor: row.values.supervisorName || "",
        Projects: row.projectNames.join(", ") || "Unassigned",
        "Completion %": row.completion.percent,
        "Missing Count": row.completion.missing.length,
        "Missing Fields": row.completion.missing.map((field) => field.label).join(", "),
        "Pending Verification": row.completion.pendingVerification
          .map((field) => field.label)
          .join(", "),
        "Rejected Documents": row.completion.rejected
          .map((field) => field.label)
          .join(", "),
        "Expired Fields": row.completion.expired.map((field) => field.label).join(", "),
        "Expiring Within 90 Days": row.completion.expiringSoon
          .map((field) => field.label)
          .join(", "),
        "Profile Status": row.completion.status,
        "Compliance Status": complianceStatusLabel(
          row.completion.complianceStatus
        ),
        "Attachments Count": row.attachmentCount,
        "Last Updated": formatDate(row.user.profileUpdatedAt),
      };

      CREW_PROFILE_FIELDS.forEach((field) => {
        if (field.type === "file") {
          base[`${field.label} - File Name`] = attachments[field.key]?.name || "";
          base[`${field.label} - Link`] = attachments[field.key]?.url || "";
          base[`${field.label} - Status`] = getCrewAttachmentStatus(
            attachments[field.key]
          );
          base[`${field.label} - Reviewer`] =
            attachments[field.key]?.reviewerName || "";
          base[`${field.label} - Rejection Reason`] =
            attachments[field.key]?.rejectionReason || "";
        } else {
          base[field.label] = row.values[field.key] || "";
        }
      });

      return base;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const projectWorksheet = XLSX.utils.json_to_sheet(
      projectCompliance.map((project) => ({
        Project: project.name,
        Site: project.site,
        "Total Crew": project.total,
        Compliant: project.compliant,
        "Needs Attention": project.attention,
        "Compliance %": project.percent,
      }))
    );
    const workbook = XLSX.utils.book_new();

    worksheet["!cols"] = Object.keys(exportRows[0] || { "Crew Member": "" }).map((key) => ({
      wch: Math.min(Math.max(key.length + 4, 16), 42),
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Crew Profiles");
    XLSX.utils.book_append_sheet(workbook, projectWorksheet, "Project Compliance");
    XLSX.writeFile(workbook, `Crew_Profiles_${todayFileStamp()}.xlsx`);
  }

  return (
    <PermissionGuard module="crew_profile" action="view_all" showMessage={true}>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <div className="badge mb-3">Crew Administration</div>
            <h1 className="page-title">Crew Profiles Dashboard</h1>
            <p className="page-subtitle">
              Review crew profile completion, missing data, uploaded documents,
              and contact details from one HCAD dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            disabled={loading || filteredRows.length === 0}
            className="btn-primary gap-2"
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="card-modern">
            <div className="text-sm text-slate-500 dark:text-slate-400">Total Crew</div>
            <div className="mt-2 flex items-center gap-2 text-3xl font-black text-slate-950 dark:text-white">
              <Users size={24} />
              {stats.total}
            </div>
          </div>
          <div className="card-modern">
            <div className="text-sm text-slate-500 dark:text-slate-400">Compliant</div>
            <div className="mt-2 flex items-center gap-2 text-3xl font-black text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 size={24} />
              {stats.compliant}
            </div>
          </div>
          <div className="card-modern">
            <div className="text-sm text-slate-500 dark:text-slate-400">Needs Attention</div>
            <div className="mt-2 text-3xl font-black text-amber-600 dark:text-amber-300">
              {stats.attention}
            </div>
          </div>
          <div className="card-modern">
            <div className="text-sm text-slate-500 dark:text-slate-400">Expired</div>
            <div className="mt-2 flex items-center gap-2 text-3xl font-black text-red-600 dark:text-red-300">
              <AlertCircle size={24} />
              {stats.expired}
            </div>
          </div>
        </div>

        <div className="card-modern">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input pl-9"
                placeholder="Search by name, email, role, employee ID, mobile, city..."
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="select"
            >
              <option value="all">All statuses</option>
              <option value="compliant">Compliant</option>
              <option value="incomplete">Incomplete</option>
              <option value="pending_verification">Pending verification</option>
              <option value="expiring_soon">Expiring soon</option>
              <option value="expired">Expired</option>
              <option value="rejected">Rejected documents</option>
            </select>

            <select
              value={jobTitleFilter}
              onChange={(event) => setJobTitleFilter(event.target.value)}
              className="select"
            >
              <option value="all">All job titles</option>
              {filterOptions.jobTitles.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>

            <select
              value={employmentTypeFilter}
              onChange={(event) => setEmploymentTypeFilter(event.target.value)}
              className="select"
            >
              <option value="all">All employment types</option>
              {filterOptions.employmentTypes.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>

            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="select"
            >
              <option value="all">All projects</option>
              <option value="unassigned">Unassigned crew</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {getProjectDisplayName(project)}
                </option>
              ))}
            </select>

            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="select"
            >
              <option value="all">All work locations</option>
              {filterOptions.locations.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>

            <select
              value={supervisorFilter}
              onChange={(event) => setSupervisorFilter(event.target.value)}
              className="select"
            >
              <option value="all">All supervisors</option>
              {filterOptions.supervisors.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-6">
        <div className={`table-modern overflow-x-auto ${hasActiveFilters ? "order-2" : "order-1"}`}>
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <h2 className="section-title">Project / Site Compliance</h2>
          </div>
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70">
              <tr>
                <th className="p-4">Project</th>
                <th className="p-4">Site</th>
                <th className="p-4">Total Crew</th>
                <th className="p-4">Compliant</th>
                <th className="p-4">Needs Attention</th>
                <th className="p-4">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {projectCompliance.map((project) => (
                <tr key={project.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-4 font-black">{project.name}</td>
                  <td className="p-4">{project.site}</td>
                  <td className="p-4">{project.total}</td>
                  <td className="p-4 text-emerald-600">{project.compliant}</td>
                  <td className="p-4 text-amber-600">{project.attention}</td>
                  <td className="p-4"><span className="badge">{project.percent}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`table-modern overflow-x-auto ${hasActiveFilters ? "order-1" : "order-2"}`}>
          <table className="w-full min-w-[1100px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70">
              <tr>
                <th className="p-4">Crew Member</th>
                <th className="p-4">Role</th>
                <th className="p-4">Employee ID</th>
                <th className="p-4">Mobile</th>
                <th className="p-4">City</th>
                <th className="p-4">Project</th>
                <th className="p-4">Contract</th>
                <th className="p-4">Completion</th>
                <th className="p-4">Missing</th>
                <th className="p-4">Files</th>
                <th className="p-4">Updated</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="p-5 text-slate-500 dark:text-slate-400" colSpan={12}>
                    Loading crew profiles...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="p-5 text-slate-500 dark:text-slate-400" colSpan={12}>
                    No crew profiles match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.user.id}
                    className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50"
                  >
                    <td className="p-4">
                      <div className="font-black text-slate-950 dark:text-white">
                        {row.displayName}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.user.email || "-"}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="badge">{row.values.jobTitle || row.user.role || "-"}</span>
                    </td>
                    <td className="p-4 font-semibold">{row.values.employeeId || "-"}</td>
                    <td className="p-4">
                      {[row.values.mobileCountryCode, row.values.mobile].filter(Boolean).join(" ") || "-"}
                    </td>
                    <td className="p-4">{row.values.city || "-"}</td>
                    <td className="p-4 text-xs">{row.projectNames.join(", ") || "Unassigned"}</td>
                    <td className="p-4">
                      <span
                        className={`badge ${
                          row.values.contractEndDate &&
                          contractDaysLabel(row.values.contractEndDate).includes("left") &&
                          Number(contractDaysLabel(row.values.contractEndDate).split(" ")[0]) <= 90
                            ? "border-amber-500/25 bg-amber-500/10 text-amber-700"
                            : contractDaysLabel(row.values.contractEndDate).startsWith("Expired")
                            ? "border-red-500/25 bg-red-500/10 text-red-700"
                            : ""
                        }`}
                      >
                        {contractDaysLabel(row.values.contractEndDate)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`badge ${statusClass(row.completion.complianceStatus)}`}
                      >
                        {row.completion.percent}% - {complianceStatusLabel(row.completion.complianceStatus)}
                      </span>
                    </td>
                    <td className="p-4">{row.completion.missing.length}</td>
                    <td className="p-4">{row.attachmentCount}</td>
                    <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(row.user.profileUpdatedAt)}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.user.id)}
                        className="btn-secondary px-3 py-2"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>

        {selectedRow && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Close profile details"
              className="absolute inset-0 cursor-default"
              onClick={() => setSelectedId("")}
            />

            <aside className="relative h-full w-full max-w-4xl overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#07111f]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="badge mb-3">Profile Details</div>
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                    {selectedRow.displayName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {selectedRow.user.email || "-"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId("")}
                  className="btn-secondary h-10 w-10 p-0"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-3">
                <div className="card-soft">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Completion</div>
                  <div className="mt-1 text-2xl font-black">
                    {selectedRow.completion.percent}%
                  </div>
                </div>
                <div className="card-soft">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Missing Fields</div>
                  <div className="mt-1 text-2xl font-black">
                    {selectedRow.completion.missing.length}
                  </div>
                </div>
                <div className="card-soft">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Attachments</div>
                  <div className="mt-1 text-2xl font-black">
                    {selectedRow.attachmentCount}
                  </div>
                </div>
              </div>

              <div className="card-modern mb-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-500">HR Review Status</div>
                    <div className="mt-1 text-lg font-black capitalize">
                      {(selectedRow.user.crewProfileReviewStatus || "draft").replaceAll("_", " ")}
                    </div>
                    {selectedRow.user.crewProfileReviewNotes && (
                      <p className="mt-2 text-sm">{selectedRow.user.crewProfileReviewNotes}</p>
                    )}
                    {selectedRow.user.crewProfileUpdateRequestReason && (
                      <div className="notice-warning mt-3">
                        Update request: {selectedRow.user.crewProfileUpdateRequestReason}
                      </div>
                    )}
                  </div>

                  {canReviewAttachments && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={reviewingProfile}
                        onClick={() => updateContractEndDate(selectedRow.user)}
                        className="btn-secondary"
                      >
                        Edit Contract End
                      </button>
                      {selectedRow.user.crewProfileReviewStatus === "submitted" && (
                        <>
                          <button
                            type="button"
                            disabled={reviewingProfile}
                            onClick={() => reviewProfile(selectedRow.user, "request_changes")}
                            className="btn-secondary"
                          >
                            Request Changes
                          </button>
                          <button
                            type="button"
                            disabled={reviewingProfile}
                            onClick={() => reviewProfile(selectedRow.user, "verify")}
                            className="btn-primary"
                          >
                            Verify Profile
                          </button>
                        </>
                      )}
                      {selectedRow.user.crewProfileReviewStatus === "update_requested" && (
                        <>
                          <button
                            type="button"
                            disabled={reviewingProfile}
                            onClick={() => reviewProfile(selectedRow.user, "reject_update")}
                            className="btn-secondary"
                          >
                            Reject Request
                          </button>
                          <button
                            type="button"
                            disabled={reviewingProfile}
                            onClick={() => reviewProfile(selectedRow.user, "reopen")}
                            className="btn-primary"
                          >
                            Approve & Reopen
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedRow.completion.missing.length > 0 && (
                <div className="notice-warning mb-5">
                  <div className="mb-3 font-black">Missing fields</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRow.completion.missing.map((field) => (
                      <span key={field.key} className="badge">
                        {field.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRow.completion.expired.length > 0 && (
                <div className="notice-danger mb-5">
                  <div className="mb-3 font-black">Expired required items</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRow.completion.expired.map((field) => (
                      <span key={field.key} className="badge">
                        {field.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRow.completion.expiringSoon.length > 0 && (
                <div className="notice-warning mb-5">
                  <div className="mb-3 font-black">Expiring within 90 days</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedRow.completion.expiringSoon.map((field) => (
                      <span key={field.key} className="badge">
                        {field.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {CREW_PROFILE_SECTIONS.map((section) => (
                  <section key={section.key} className="card-modern">
                    <h3 className="section-title">{section.title}</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {section.fields.map((field) => {
                        const value = fieldDisplayValue(
                          field.key,
                          selectedRow.values,
                          selectedRow.user.crewProfileAttachments || {}
                        );
                        const attachment = selectedRow.user.crewProfileAttachments?.[field.key];

                        return (
                          <div key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                              {field.label}
                            </div>
                            {field.type === "file" ? (
                              attachment?.url ? (
                                <div className="mt-2 space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <a
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 text-sm font-black text-blue-600 hover:underline dark:text-blue-300"
                                    >
                                      <FileText size={15} />
                                      {attachment.name || "Open attachment"}
                                      <ExternalLink size={13} />
                                    </a>
                                    <span className="badge capitalize">
                                      {getCrewAttachmentStatus(attachment)}
                                    </span>
                                  </div>

                                  {attachment.reviewerName && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      Reviewed by {attachment.reviewerName}
                                      {attachment.reviewedAt
                                        ? ` on ${formatDate(attachment.reviewedAt)}`
                                        : ""}
                                    </div>
                                  )}

                                  {attachment.rejectionReason && (
                                    <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-2 text-xs font-bold text-red-700 dark:text-red-200">
                                      Rejection reason: {attachment.rejectionReason}
                                    </div>
                                  )}

                                  {canReviewAttachments && (
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={
                                          reviewingAttachment ===
                                          `${selectedRow.user.id}:${field.key}`
                                        }
                                        onClick={() =>
                                          reviewAttachment(
                                            selectedRow.user,
                                            field.key,
                                            "verified"
                                          )
                                        }
                                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                      >
                                        Verify
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          reviewingAttachment ===
                                          `${selectedRow.user.id}:${field.key}`
                                        }
                                        onClick={() =>
                                          reviewAttachment(
                                            selectedRow.user,
                                            field.key,
                                            "rejected"
                                          )
                                        }
                                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-2 text-sm font-semibold text-slate-400">-</div>
                              )
                            ) : (
                              <div className="mt-2 break-words text-sm font-black text-slate-950 dark:text-white">
                                {value || "-"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
