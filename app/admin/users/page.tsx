"use client";

import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { AlertTriangle, CheckCircle2, Search, ShieldCheck, Users } from "lucide-react";
import PermissionGuard from "@/app/components/PermissionGuard";
import { auth, db } from "@/lib/firebase";
import { getCrewProfileCompletion, getCrewProfileRequirementMode, getCrewProfileValues, type CrewProfileRequirementMode } from "@/lib/crewProfile";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import { getUserAccountType, type UserAccountType } from "@/lib/userAccounts";

type UserType = {
  id: string; name?: string; fullNameEn?: string; fullNameAr?: string; email?: string;
  mobile?: string; employeeId?: string; role?: string; active: boolean;
  accountStatus?: "pending" | "active" | "suspended"; accountType?: UserAccountType;
  crewProfileRequirementMode?: CrewProfileRequirementMode; crewProfile?: Record<string, string>;
  crewProfileAttachments?: Record<string, any>; crewProfileReviewStatus?: string;
  requestedRole?: string; requestedJobTitle?: string; roleRequestStatus?: string;
  roleRequestedAt?: any; roleReviewNote?: string;
};
type EnrichedUser = UserType & { jobTitle: string; completion: number; missingCount: number; attentionReason: string; priority: number };

const normalized = (value: unknown) => String(value || "").trim().toLowerCase();
const dateMillis = (value: any) => value?.toMillis?.() || value?.toDate?.()?.getTime?.() || 0;

function resolveRequestedRole(user: UserType, roles: string[]) {
  const requested = String(user.requestedRole || user.requestedJobTitle || "").trim();
  if (!requested) return user.role || "";
  const exact = roles.find((role) => normalized(role) === normalized(requested));
  if (exact) return exact;
  if (/paramedic|emergency medical technician|\bemt\b/i.test(requested)) return roles.find((role) => normalized(role) === "paramedic") || user.role || "";
  if (/ambulance.*driver|^driver$/i.test(requested)) return roles.find((role) => /driver/i.test(role)) || user.role || "";
  return user.role || "";
}

function enrichUser(user: UserType): EnrichedUser {
  const values = getCrewProfileValues(user);
  const completion = getCrewProfileCompletion(values, user.crewProfileAttachments || {}, getCrewProfileRequirementMode(user));
  const review = normalized(user.crewProfileReviewStatus);
  const roleReview = normalized(user.roleRequestStatus);
  const accountStatus = normalized(user.accountStatus);
  let priority = 60;
  let attentionReason = "Active account";
  if (["pending", "resubmitted"].includes(roleReview) && review === "verified") {
    priority = 1; attentionReason = roleReview === "resubmitted" ? "Role request resubmitted" : "Role approval required";
  } else if (["pending", "resubmitted"].includes(roleReview)) {
    priority = 2; attentionReason = "Profile submitted — review required";
  } else if (!user.active && accountStatus !== "suspended") {
    priority = 3; attentionReason = "Account needs activation";
  } else if (["submitted", "update_requested", "reopened"].includes(review)) {
    priority = 4; attentionReason = review === "submitted" ? "Profile awaiting HR review" : "Profile update needs attention";
  } else if (completion.missing.length || completion.rejected.length) {
    priority = 5; attentionReason = `${completion.missing.length + completion.rejected.length} profile item(s) need attention`;
  } else if (roleReview === "changes_requested") {
    priority = 6; attentionReason = "Waiting for employee changes";
  } else if (roleReview === "rejected") {
    priority = 70; attentionReason = "Role request rejected";
  } else if (accountStatus === "suspended") {
    priority = 90; attentionReason = "Account suspended";
  }
  return { ...user, jobTitle: String(values.jobTitle || user.requestedJobTitle || ""), completion: completion.percent, missingCount: completion.missing.length + completion.rejected.length, attentionReason, priority };
}

export default function UsersPage() {
  const { user: reviewer } = useCurrentUser();
  const { can, isAdmin } = usePermissions(reviewer?.role);
  const [users, setUsers] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [attentionFilter, setAttentionFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [requestedRoleFilter, setRequestedRoleFilter] = useState("all");
  const [jobTitleFilter, setJobTitleFilter] = useState("all");
  const [roleRequestFilter, setRoleRequestFilter] = useState("all");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const canEdit = isAdmin || can("users", "edit");

  useEffect(() => onSnapshot(collection(db, "users"), (snapshot) => {
    setUsers(snapshot.docs.map((entry) => { const data = entry.data() as Omit<UserType, "id">; return { id: entry.id, ...data, active: data.active !== false }; }));
    setLoading(false);
  }), []);
  useEffect(() => onSnapshot(collection(db, "roles"), (snapshot) => setRoles(snapshot.docs.map((entry) => entry.id).sort((a, b) => a.localeCompare(b)))), []);

  const enrichedUsers = useMemo(() => users.map(enrichUser).sort((a, b) => a.priority - b.priority || dateMillis(b.roleRequestedAt) - dateMillis(a.roleRequestedAt) || String(a.name || a.email).localeCompare(String(b.name || b.email))), [users]);
  const activeTemporaryCount = enrichedUsers.filter(
    (entry) =>
      entry.active &&
      getUserAccountType(entry) === "employee" &&
      getCrewProfileRequirementMode(entry) === "temporary"
  ).length;
  const stats = useMemo(() => ({
    attention: enrichedUsers.filter((entry) => entry.priority < 10).length,
    roleApproval: enrichedUsers.filter((entry) => ["pending", "resubmitted"].includes(normalized(entry.roleRequestStatus))).length,
    inactive: enrichedUsers.filter((entry) => !entry.active && normalized(entry.accountStatus) !== "suspended").length,
    profileIssues: enrichedUsers.filter((entry) => entry.missingCount > 0 || ["submitted", "update_requested"].includes(normalized(entry.crewProfileReviewStatus))).length,
    active: enrichedUsers.filter((entry) => entry.active).length,
  }), [enrichedUsers]);
  const filterOptions = useMemo(() => ({
    jobTitles: Array.from(new Set(enrichedUsers.map((entry) => entry.jobTitle).filter(Boolean))).sort(),
    requestedRoles: Array.from(new Set(enrichedUsers.map((entry) => entry.requestedRole || entry.requestedJobTitle || "").filter(Boolean))).sort(),
  }), [enrichedUsers]);

  const visibleUsers = useMemo(() => {
    const needle = normalized(search);
    return enrichedUsers.filter((entry) => {
      const account = entry.accountStatus || (entry.active ? "active" : "pending");
      const attentionMatches = attentionFilter === "all" || (attentionFilter === "needs_attention" && entry.priority < 10) || (attentionFilter === "role_approval" && ["pending", "resubmitted"].includes(normalized(entry.roleRequestStatus))) || (attentionFilter === "inactive" && !entry.active) || (attentionFilter === "profile_issues" && (entry.missingCount > 0 || normalized(entry.crewProfileReviewStatus) === "submitted")) || (attentionFilter === "active" && entry.active);
      const requested = String(entry.requestedRole || entry.requestedJobTitle || "");
      const textMatches = !needle || [entry.name, entry.fullNameEn, entry.fullNameAr, entry.email, entry.mobile, entry.employeeId, entry.role, requested, entry.jobTitle].some((value) => normalized(value).includes(needle));
      return attentionMatches && (accountFilter === "all" || account === accountFilter) && (profileFilter === "all" || normalized(entry.crewProfileReviewStatus || "draft") === profileFilter) && (roleFilter === "all" || entry.role === roleFilter) && (requestedRoleFilter === "all" || requested === requestedRoleFilter) && (jobTitleFilter === "all" || entry.jobTitle === jobTitleFilter) && (roleRequestFilter === "all" || normalized(entry.roleRequestStatus || "none") === roleRequestFilter) && (accountTypeFilter === "all" || getUserAccountType(entry) === accountTypeFilter) && textMatches;
    });
  }, [accountFilter, accountTypeFilter, attentionFilter, enrichedUsers, jobTitleFilter, profileFilter, requestedRoleFilter, roleFilter, roleRequestFilter, search]);

  async function reviewRole(target: EnrichedUser, action: "approve" | "request_changes" | "reject" | "suspend" | "activate") {
    if (!canEdit) return;
    let note = "";
    if (action === "request_changes") { note = window.prompt("Enter the changes required from the employee:") || ""; if (!note.trim()) return; }
    if (action === "reject" && !window.confirm("Reject this role request and keep the account inactive?")) return;
    if (action === "suspend" && !window.confirm("Suspend this user's access?")) return;
    const role = selectedRoles[target.id] || resolveRequestedRole(target, roles);
    setBusyUserId(target.id);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/users/role-review", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ userId: target.id, action, role, note }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update the account.");
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not update the account."); } finally { setBusyUserId(""); }
  }

  async function upgradeActiveProfilesToFull() {
    if (!canEdit || activeTemporaryCount === 0) return;
    if (!window.confirm(`Convert ${activeTemporaryCount} active employee profile(s) from Temporary to Full?`)) return;
    setBusyUserId("bulk-full");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/users/role-review", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upgrade_active_profiles_to_full" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not upgrade active profiles.");
      window.alert(`${result.updated || 0} active profile(s) converted to Full.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not upgrade active profiles.");
    } finally {
      setBusyUserId("");
    }
  }

  async function updateAccountType(userId: string, accountType: UserAccountType) { if (canEdit) await updateDoc(doc(db, "users", userId), { accountType }); }
  async function updateProfileRequirementMode(target: EnrichedUser, mode: CrewProfileRequirementMode) {
    if (!canEdit) return;
    const completion = getCrewProfileCompletion(getCrewProfileValues(target), target.crewProfileAttachments || {}, mode);
    await updateDoc(doc(db, "users", target.id), { crewProfileRequirementMode: mode, crewProfileCompletion: completion.percent, crewProfileMissingFields: completion.missing.map((field) => field.key), crewProfilePendingVerificationFields: completion.pendingVerification.map((field) => field.key), crewProfileRejectedFields: completion.rejected.map((field) => field.key), crewProfileExpiredFields: completion.expired.map((field) => field.key), crewProfileExpiringSoonFields: completion.expiringSoon.map((field) => field.key), crewProfileStatus: completion.status, crewProfileComplianceStatus: completion.complianceStatus, crewProfileIsComplete: completion.isComplete, crewProfileIsCompliant: completion.isCompliant });
  }
  function exportToExcel() {
    const data = visibleUsers.map((entry) => ({ Name: entry.name || entry.fullNameEn || entry.fullNameAr || "", Email: entry.email || "", "Employee ID": entry.employeeId || "", "Job Title": entry.jobTitle, "Current Role": entry.role || "", "Requested Role": entry.requestedRole || entry.requestedJobTitle || "", "Role Request": entry.roleRequestStatus || "", "Profile Review": entry.crewProfileReviewStatus || "draft", Completion: `${entry.completion}%`, Status: entry.accountStatus || (entry.active ? "active" : "pending"), "Attention Reason": entry.attentionReason }));
    const worksheet = XLSX.utils.json_to_sheet(data); worksheet["!cols"] = Array(11).fill({ wch: 24 });
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Users"); XLSX.writeFile(workbook, "Users_Management.xlsx");
  }
  const clearFilters = () => { setSearch(""); setAttentionFilter("all"); setAccountFilter("all"); setProfileFilter("all"); setRoleFilter("all"); setRequestedRoleFilter("all"); setJobTitleFilter("all"); setRoleRequestFilter("all"); setAccountTypeFilter("all"); };

  if (loading) return <div className="p-6"><div className="card-modern">Loading users...</div></div>;
  const statsCards: Array<[string, number, string, any]> = [["Needs Attention", stats.attention, "needs_attention", AlertTriangle], ["Role Approval", stats.roleApproval, "role_approval", ShieldCheck], ["Inactive", stats.inactive, "inactive", Users], ["Profile Issues", stats.profileIssues, "profile_issues", AlertTriangle], ["Active", stats.active, "active", CheckCircle2]];

  return <PermissionGuard module="users" action="view" showMessage><div className="page-shell space-y-5">
    <div className="page-header"><div><span className="badge">Administration</span><h1 className="page-title mt-3">Users Management</h1><p className="page-subtitle">Attention-first role approval, profile review, and account access.</p></div><div className="flex flex-wrap gap-2">{activeTemporaryCount > 0 && <button disabled={!canEdit || busyUserId === "bulk-full"} onClick={upgradeActiveProfilesToFull} className="btn-secondary">{busyUserId === "bulk-full" ? "Upgrading..." : `Move Active to Full (${activeTemporaryCount})`}</button>}<button onClick={exportToExcel} className="btn-primary">Export Filtered Excel</button></div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{statsCards.map(([label, value, filter, Icon]) => <button key={label} onClick={() => setAttentionFilter(filter)} className={`card-modern text-left transition hover:border-[#74cdda] ${attentionFilter === filter ? "border-[#274C5A] ring-2 ring-[#274C5A]/10" : ""}`}><Icon size={17} className="text-[#274C5A]"/><div className="mt-2 text-xs font-bold text-[#607482]">{label}</div><div className="text-2xl font-black text-[#123746]">{value}</div></button>)}</div>
    <div className="card-modern space-y-3"><div className="relative"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#607482]"/><input className="input w-full pl-11" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, Arabic name, email, employee ID, mobile, job title, or role"/></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <select className="select" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}><option value="all">All Accounts</option><option value="pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
      <select className="select" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}><option value="all">All Profile Statuses</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="verified">Verified</option><option value="changes_required">Changes Required</option><option value="update_requested">Update Requested</option></select>
      <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="all">All Current Roles</option>{roles.map((role) => <option key={role}>{role}</option>)}</select>
      <select className="select" value={requestedRoleFilter} onChange={(e) => setRequestedRoleFilter(e.target.value)}><option value="all">All Requested Roles</option>{filterOptions.requestedRoles.map((role) => <option key={role}>{role}</option>)}</select>
      <select className="select" value={jobTitleFilter} onChange={(e) => setJobTitleFilter(e.target.value)}><option value="all">All Job Titles</option>{filterOptions.jobTitles.map((title) => <option key={title}>{title}</option>)}</select>
      <select className="select" value={roleRequestFilter} onChange={(e) => setRoleRequestFilter(e.target.value)}><option value="all">All Role Requests</option><option value="pending">Pending</option><option value="resubmitted">Resubmitted</option><option value="approved">Approved</option><option value="changes_requested">Changes Requested</option><option value="rejected">Rejected</option><option value="none">Not Requested</option></select>
      <select className="select" value={accountTypeFilter} onChange={(e) => setAccountTypeFilter(e.target.value)}><option value="all">All Account Types</option><option value="employee">Employee</option><option value="client">Client</option></select>
      <button className="btn-secondary" onClick={clearFilters}>Clear Filters</button></div><div className="text-xs font-semibold text-[#607482]">Showing {visibleUsers.length} of {users.length}. Accounts requiring action are sorted first automatically.</div></div>
    <div className="table-modern overflow-x-auto"><table className="w-full min-w-[1450px] text-left text-sm"><thead className="border-b border-[#d8e6ea] bg-[#f7fbfc] text-xs uppercase tracking-wide text-[#607482]"><tr><th className="p-3">User</th><th className="p-3">Attention</th><th className="p-3">Job / Profile</th><th className="p-3">Current Role</th><th className="p-3">Requested / Approve As</th><th className="p-3">Account</th><th className="p-3">Settings</th><th className="p-3">Actions</th></tr></thead><tbody>{visibleUsers.map((entry) => {
      const requested = entry.requestedRole || entry.requestedJobTitle || "—"; const approvalRole = selectedRoles[entry.id] ?? resolveRequestedRole(entry, roles); const needsAttention = entry.priority < 10;
      const hasRoleRequest = ["pending", "resubmitted", "changes_requested"].includes(normalized(entry.roleRequestStatus));
      const showActivation = hasRoleRequest || (!entry.active && normalized(entry.accountStatus) !== "suspended");
      return <tr key={entry.id} className={`border-t border-[#e1ebef] align-top ${needsAttention ? "bg-amber-50/45" : "hover:bg-[#f7fbfc]"}`}>
        <td className="p-3"><div className="font-black text-[#123746]">{entry.name || entry.fullNameEn || entry.fullNameAr || "Unnamed user"}</div><div className="text-xs font-semibold text-[#607482]">{entry.email || "—"}</div><div className="mt-1 text-xs text-[#7F7F7F]">ID: {entry.employeeId || "Missing"}</div></td>
        <td className="p-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${needsAttention ? "border-amber-300 bg-amber-100 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{entry.attentionReason}</span>{entry.roleReviewNote && <div className="mt-2 max-w-[240px] text-xs text-rose-700">{entry.roleReviewNote}</div>}</td>
        <td className="p-3"><div className="font-bold text-[#123746]">{entry.jobTitle || "Not selected"}</div><div className="mt-1 text-xs text-[#607482]">{entry.completion}% • {(entry.crewProfileReviewStatus || "draft").replaceAll("_", " ")}</div>{entry.missingCount > 0 && <div className="mt-1 text-xs font-bold text-rose-700">{entry.missingCount} item(s) missing/rejected</div>}</td>
        <td className="p-3 font-bold text-[#274C5A]">{entry.role || "none"}</td>
        <td className="p-3"><div className="mb-2 text-xs font-bold text-[#607482]">Requested: {requested}</div><select disabled={!canEdit} className="select min-w-[190px]" value={approvalRole} onChange={(e) => setSelectedRoles((current) => ({ ...current, [entry.id]: e.target.value }))}><option value="">Select role</option>{roles.map((role) => <option key={role}>{role}</option>)}</select></td>
        <td className="p-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-black ${entry.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : normalized(entry.accountStatus) === "suspended" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-100 text-slate-700"}`}>{entry.accountStatus || (entry.active ? "active" : "pending")}</span><div className="mt-2 text-xs font-semibold capitalize text-[#607482]">Role: {(entry.roleRequestStatus || "not requested").replaceAll("_", " ")}</div></td>
        <td className="p-3 space-y-2"><select disabled={!canEdit} value={getUserAccountType(entry)} onChange={(e) => updateAccountType(entry.id, e.target.value as UserAccountType)} className="select min-w-[130px]"><option value="employee">Employee</option><option value="client">Client</option></select><select disabled={!canEdit || entry.active} title={entry.active ? "Active employee profiles are always Full" : undefined} value={getCrewProfileRequirementMode(entry)} onChange={(e) => updateProfileRequirementMode(entry, e.target.value as CrewProfileRequirementMode)} className="select min-w-[130px]"><option value="temporary">Temporary</option><option value="full">Full</option></select></td>
        <td className="p-3"><div className="flex min-w-[250px] flex-wrap gap-2">{showActivation && <button disabled={!canEdit || busyUserId === entry.id || !approvalRole} onClick={() => reviewRole(entry, "approve")} className="btn-primary px-3 py-2 text-xs">{entry.active ? "Approve Role" : hasRoleRequest ? "Approve & Activate" : "Activate Account"}</button>}{hasRoleRequest && <><button disabled={!canEdit || busyUserId === entry.id} onClick={() => reviewRole(entry, "request_changes")} className="btn-secondary px-3 py-2 text-xs">Request Role Change</button><button disabled={!canEdit || busyUserId === entry.id} onClick={() => reviewRole(entry, "reject")} className="btn-secondary px-3 py-2 text-xs text-rose-700">Reject</button></>}{entry.active ? <button disabled={!canEdit || busyUserId === entry.id} onClick={() => reviewRole(entry, "suspend")} className="btn-secondary px-3 py-2 text-xs">Suspend</button> : normalized(entry.accountStatus) === "suspended" && <button disabled={!canEdit || busyUserId === entry.id} onClick={() => reviewRole(entry, "activate")} className="btn-secondary px-3 py-2 text-xs">Reactivate</button>}</div></td>
      </tr>;
    })}</tbody></table></div>
  </div></PermissionGuard>;
}
