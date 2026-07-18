"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import {
  ReadinessChecklistItem,
  calculateReadiness,
  classifyReadinessItem,
  canEditOwnDraft,
  canSubmitChecklist,
  canViewChecklist,
  checkAllEligibleItems,
  reviewReadinessChecklist,
  submitReadinessChecklist,
  updateReadinessChecklistDraft,
} from "@/lib/readinessChecklist";
import { hasPermission } from "@/lib/usePermissions";
import { getChecklistMissionDisplay, getUnitDisplayName } from "@/lib/displayLabels";

const STATUS_OPTIONS = [
  { value: "unchecked", label: "Select" },
  { value: "checked", label: "Yes" },
  { value: "missing", label: "No" },
  { value: "some", label: "Some" },
  { value: "not_applicable", label: "N/A" },
];

function formatDateTime(value: any) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", { timeZone: "Asia/Riyadh" });
}

function resultClass(result: string) {
  if (result === "Ready") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (result === "Ready with Warnings") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-red-500/30 bg-red-500/10 text-red-100";
}

function vehicleSeverityBadge(item: ReadinessChecklistItem) {
  if (item.vehicleSeverity === "red") {
    return <span className="badge bg-red-500/10 text-red-200">Red Vehicle</span>;
  }
  if (item.vehicleSeverity === "yellow") {
    return <span className="badge bg-amber-500/10 text-amber-200">Yellow Vehicle</span>;
  }
  if (item.vehicleSeverity === "green") {
    return <span className="badge bg-emerald-500/10 text-emerald-200">Green Vehicle</span>;
  }
  return null;
}

function statusLabel(status: ReadinessChecklistItem["status"]) {
  if (status === "checked") return "Yes";
  if (status === "missing") return "No";
  if (status === "some") return "Some";
  if (status === "not_available") return "No";
  if (status === "not_applicable") return "N/A";
  return "Select";
}

function needsQuantity(item: ReadinessChecklistItem) {
  return Boolean(item.minQty || item.inputType === "fuel" || item.inputType === "psi");
}

function hasEnteredQuantity(item: ReadinessChecklistItem) {
  return item.actualQty !== undefined && Number.isFinite(Number(item.actualQty)) && Number(item.actualQty) > 0;
}

function quantityValidationMessage(item: ReadinessChecklistItem) {
  if (!needsQuantity(item) || (item.status !== "checked" && item.status !== "some")) return "";
  if (!hasEnteredQuantity(item)) return `Enter quantity for ${item.label}.`;

  const actual = Number(item.actualQty);
  const minimum = Number(item.minQty || 0);
  if (item.status === "checked" && minimum > 0 && actual < minimum) {
    return `${item.label}: Yes requires at least ${minimum}${item.unit ? ` ${item.unit}` : ""}. Use Some for a partial quantity.`;
  }
  if (item.status === "some" && minimum > 0 && actual >= minimum) {
    return `${item.label}: Some must be less than the minimum ${minimum}${item.unit ? ` ${item.unit}` : ""}. Use Yes when the minimum is met.`;
  }
  return "";
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function ChecklistDetailsPage({
  params,
}: {
  params: { projectId: string; checklistId: string };
}) {
  const { user, loading: userLoading } = useCurrentUser();
  const { permissions, loading: permLoading, can } = usePermissions(user?.role);

  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReadinessChecklistItem[]>([]);
  const [notes, setNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const durationMarkRef = useRef(Date.now());

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "projectChecklists", params.checklistId),
      (snap) => {
        const data: any = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setChecklist(data);
        setItems(data?.items || []);
        setNotes(data?.notes || "");
        setReviewNotes(data?.reviewNotes || "");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [params.checklistId]);

  const readiness = useMemo(() => calculateReadiness(items), [items]);
  const editable = checklist
    ? canEditOwnDraft(checklist, permissions, user)
    : false;
  const submittable = checklist
    ? canSubmitChecklist(checklist, permissions, user)
    : false;
  const reviewerCanReview = can("readiness_checklists", "review");
  const reviewerCanApprove = can("readiness_checklists", "approve");
  const reviewerCanReturn = can("readiness_checklists", "return_for_correction");
  const canReviewSubmitted = checklist?.status === "submitted" && reviewerCanReview;
  const normalizedRole = String(user?.role || "").toLowerCase();
  const isFieldUser =
    normalizedRole.includes("paramedic") ||
    normalizedRole.includes("emt") ||
    normalizedRole.includes("medic") ||
    normalizedRole.includes("ambulance");
  const canViewTiming =
    !isFieldUser &&
    (hasPermission(permissions, "readiness_checklists", "view_all", user?.role) ||
      reviewerCanReview ||
      reviewerCanApprove);
  const isOpeningChecklist = (checklist?.checklistPhase || "opening") === "opening";
  const reviewIssueItems = [
    ...readiness.vehicleRedIssues,
    ...readiness.vehicleYellowIssues,
    ...readiness.criticalIssues,
    ...readiness.missingItems,
    ...readiness.someItems,
    ...readiness.unavailableItems,
    ...readiness.insufficientQuantityItems,
  ].filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index);

  const groupedItems = useMemo(() => {
    return items.reduce<Record<string, ReadinessChecklistItem[]>>((acc, item) => {
      acc[item.section] = acc[item.section] || [];
      acc[item.section].push(item);
      return acc;
    }, {});
  }, [items]);

  function updateItem(id: string, patch: Partial<ReadinessChecklistItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function consumeElapsedSeconds() {
    const now = Date.now();
    const elapsedSeconds = Math.max(1, Math.round((now - durationMarkRef.current) / 1000));
    durationMarkRef.current = now;
    return elapsedSeconds;
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const elapsedSeconds = consumeElapsedSeconds();
      await updateReadinessChecklistDraft(params.checklistId, {
        items,
        notes,
        durationSeconds: Number(checklist?.durationSeconds || 0) + elapsedSeconds,
      });
      alert("Draft saved.");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    const quantityError = items.map(quantityValidationMessage).find(Boolean);
    if (quantityError) {
      alert(quantityError);
      return;
    }
    const unansweredBlockingVehicle = items.filter(
      (item) => classifyReadinessItem(item).vehicleSeverity === "red" && item.status === "unchecked"
    );
    if (unansweredBlockingVehicle.length > 0) {
      alert(`Answer red vehicle items first: ${unansweredBlockingVehicle.map((item) => item.label).join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      const elapsedSeconds = consumeElapsedSeconds();
      await submitReadinessChecklist(params.checklistId, {
        items,
        notes,
        submittedAtMs: Date.now(),
        durationSeconds: Number(checklist?.durationSeconds || 0) + elapsedSeconds,
      });
      alert("Checklist submitted.");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to submit checklist.");
    } finally {
      setSaving(false);
    }
  }

  async function review(action: "approved" | "returned_for_correction") {
    setSaving(true);
    try {
      await reviewReadinessChecklist(params.checklistId, action, user, reviewNotes);
      alert(action === "approved" ? "Checklist approved." : "Checklist returned for correction.");
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Failed to review checklist.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || userLoading || permLoading) {
    return <div className="card-modern">Loading checklist...</div>;
  }

  if (!checklist) {
    return <div className="card-modern">Checklist not found.</div>;
  }

  if (!canViewChecklist(checklist, permissions, user)) {
    return (
      <div className="card-modern max-w-2xl">
        <h2 className="text-xl font-bold text-white">Access denied</h2>
        <p className="mt-2 text-slate-400">
          You do not have permission to view this readiness checklist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            {(checklist.checklistPhase || "opening") === "closing" ? "Closing" : "Readiness"} Checklist{" "}
            {getChecklistMissionDisplay(checklist)}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {checklist.projectName || "Project"} / {getUnitDisplayName({ unitCode: checklist.unitCode, unitId: checklist.unitId }) || "-"} / {checklist.dateKey} / {checklist.shiftKey}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href={`/projects/${params.projectId}/checklists`}>
            Back
          </Link>
          <Link className="btn-secondary" href={`/missions/${checklist.missionId}`}>
            Mission
          </Link>
          {isOpeningChecklist &&
            checklist.status === "approved" &&
            hasPermission(permissions, "readiness_checklists", "create", user?.role) && (
              <Link
                className="btn-primary"
                href={`/projects/${params.projectId}/checklists/new?phase=closing&sourceChecklistId=${checklist.id}&missionId=${checklist.missionId || ""}`}
              >
                Start Closing Checklist
              </Link>
            )}
        </div>
      </div>

      <div className={`rounded-xl border p-5 ${resultClass(readiness.result)}`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm opacity-80">Result</div>
            <div className="text-2xl font-black">{readiness.result}</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Readiness Score</div>
            <div className="text-2xl font-black">{readiness.readinessScore}%</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Status</div>
            <div className="text-2xl font-black">{checklist.status}</div>
          </div>
          <div>
            <div className="text-sm opacity-80">Updated</div>
            <div className="text-sm font-bold">{formatDateTime(checklist.updatedAt)}</div>
          </div>
        </div>
        {canViewTiming && (
          <div className="card-modern">
            <div className="text-sm text-slate-400">Checklist Duration</div>
            <div className="mt-1 font-bold text-white">
              {formatDuration(checklist.durationSeconds)}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card-modern">
          <div className="text-sm text-slate-400">Inspector</div>
          <div className="mt-1 font-bold text-white">
            {checklist.inspectorName || checklist.inspectorUserId}
          </div>
        </div>
        <div className="card-modern">
          <div className="text-sm text-slate-400">Service / Deployment</div>
          <div className="mt-1 font-bold text-white">
            {checklist.serviceType || "-"} / {checklist.deploymentType || "-"}
          </div>
        </div>
        <div className="card-modern">
          <div className="text-sm text-slate-400">Issues</div>
          <div className="mt-1 font-bold text-white">
            {readiness.vehicleRedIssues.length} vehicle red,{" "}
            {readiness.vehicleYellowIssues.length} vehicle yellow,{" "}
            {readiness.shortageIssues.length} shortages,{" "}
            {readiness.criticalIssues.length} V items
          </div>
        </div>
      </div>

      <div className="card-modern space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-white">Review Summary</h3>
            <p className="mt-1 text-sm text-slate-400">
              {reviewIssueItems.length === 0
                ? "No readiness issues found."
                : `${reviewIssueItems.length} issue${reviewIssueItems.length === 1 ? "" : "s"} require attention.`}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowDetails((current) => !current)}
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        </div>

        {reviewIssueItems.length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {reviewIssueItems.slice(0, showDetails ? reviewIssueItems.length : 6).map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="font-semibold text-white">{item.label}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {statusLabel(item.status)}
                  {item.minQty ? ` / ${item.actualQty || 0} of ${item.minQty}${item.unit ? ` ${item.unit}` : ""}` : ""}
                  {item.note ? ` / ${item.note}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {canReviewSubmitted && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <h3 className="font-black text-white">Supervisor Review</h3>
            <textarea
              className="input mt-3 min-h-[100px]"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Review notes or correction instructions"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {reviewerCanReturn && (
                <button
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => review("returned_for_correction")}
                >
                  Return for Correction
                </button>
              )}
              {reviewerCanApprove && (
                <button
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => review("approved")}
                >
                  Approve
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {editable && (
        <div className="card-modern flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            Check All Eligible skips manual and V-tagged items so they must be verified directly.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setItems((prev) => checkAllEligibleItems(prev))}
          >
            Check All Eligible
          </button>
        </div>
      )}

      {(editable || showDetails) && Object.entries(groupedItems).map(([section, sectionItems]) => (
        <section key={section} className="card-modern space-y-3">
          <h3 className="font-black text-white">{section}</h3>
          <div className="space-y-3">
            {sectionItems.map((item) => {
              const displayItem = classifyReadinessItem(item);

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 xl:grid-cols-[1fr_190px_130px_1fr]"
                >
                <div>
                  <div className="font-semibold text-white">{displayItem.label}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {vehicleSeverityBadge(displayItem)}
                    {displayItem.critical && <span className="badge bg-rose-500/10 text-rose-200">V Item</span>}
                    {displayItem.manualVerify && <span className="badge bg-blue-500/10 text-blue-200">Manual</span>}
                    {displayItem.group && <span className="badge">{displayItem.group}</span>}
                    {displayItem.minQty && <span className="badge">Min {displayItem.minQty}{displayItem.unit ? ` ${displayItem.unit}` : ""}</span>}
                    {displayItem.serviceLevels?.length ? (
                      <span className="badge bg-amber-500/10 text-amber-200">
                        {displayItem.serviceLevels.join(", ")}
                      </span>
                    ) : null}
                  </div>
                </div>
                {editable ? (
                  <select
                    className="select"
                    value={item.status === "not_available" ? "missing" : item.status}
                    onChange={(e) =>
                      updateItem(item.id, {
                        status: e.target.value as ReadinessChecklistItem["status"],
                        actualQty:
                          e.target.value === "missing" ||
                          e.target.value === "not_available" ||
                          e.target.value === "not_applicable" ||
                          e.target.value === "unchecked"
                            ? undefined
                            : item.actualQty,
                      })
                    }
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="badge self-start">{statusLabel(item.status)}</span>
                )}
                {displayItem.minQty || displayItem.inputType === "fuel" || displayItem.inputType === "psi" ? (
                  editable ? (
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={item.actualQty ?? ""}
                      onChange={(e) =>
                        updateItem(item.id, {
                          actualQty: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder={displayItem.inputType === "psi" ? "PSI" : displayItem.inputType === "fuel" ? "%" : "Qty"}
                    />
                  ) : (
                    <div className="text-sm text-slate-300">
                      {displayItem.actualQty ?? "-"}{displayItem.unit ? ` ${displayItem.unit}` : ""}
                    </div>
                  )
                ) : (
                  <div className="hidden xl:block" />
                )}

                {editable ? (
                  <input
                    className="input"
                    value={item.note || ""}
                    onChange={(e) => updateItem(item.id, { note: e.target.value })}
                    placeholder="Item note"
                  />
                ) : (
                  <div className="text-sm text-slate-300">{item.note || "-"}</div>
                )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {(editable || showDetails) && <label className="card-modern block space-y-2">
        <span className="text-sm font-semibold text-slate-300">Checklist Notes</span>
        {editable ? (
          <textarea
            className="input min-h-[120px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        ) : (
          <div className="text-sm text-slate-300">{notes || "-"}</div>
        )}
      </label>}

      {showDetails && (readiness.vehicleRedIssues.length > 0 ||
        readiness.vehicleYellowIssues.length > 0 ||
        readiness.missingItems.length > 0 ||
        readiness.unavailableItems.length > 0 ||
        readiness.insufficientQuantityItems.length > 0 ||
        readiness.criticalIssues.length > 0) && (
        <div className="card-modern space-y-3">
          <h3 className="font-black text-white">Readiness Issues</h3>
          {[
            ...readiness.vehicleRedIssues,
            ...readiness.vehicleYellowIssues,
            ...readiness.criticalIssues,
            ...readiness.missingItems,
            ...readiness.unavailableItems,
            ...readiness.insufficientQuantityItems,
          ]
            .filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index)
            .map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="font-semibold text-white">{item.label}</div>
                <div className="mt-1 text-sm text-slate-400">
                  {statusLabel(item.status)}
                  {item.minQty ? ` / ${item.actualQty || 0} of ${item.minQty}${item.unit ? ` ${item.unit}` : ""}` : ""}
                  {item.note ? ` / ${item.note}` : ""}
                </div>
              </div>
            ))}
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={saving} onClick={saveDraft}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          {submittable && (
            <button className="btn-primary" disabled={saving} onClick={submit}>
              {saving ? "Submitting..." : "Submit"}
            </button>
          )}
        </div>
      )}

      {checklist.reviewNotes && checklist.status !== "submitted" && (
        <div className="card-modern">
          <h3 className="font-black text-white">Review Notes</h3>
          <p className="mt-2 text-sm text-slate-300">{checklist.reviewNotes}</p>
          <p className="mt-2 text-xs text-slate-500">
            {checklist.reviewedByName || checklist.reviewedBy || "-"} / {formatDateTime(checklist.reviewedAt)}
          </p>
        </div>
      )}
    </div>
  );
}
