"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import {
  DEPLOYMENT_TYPES,
  DeploymentType,
  ChecklistPhase,
  SERVICE_TYPES,
  SHIFT_OPTIONS,
  ServiceType,
  ReadinessChecklistItem,
  calculateReadiness,
  checkAllEligibleItems,
  cloneDefaultChecklistItems,
  createReadinessChecklist,
  getServiceDescription,
  getChecklistWizardSteps,
  getStepKeyForWizardLabel,
  getMissionLabel,
  getRiyadhDateKey,
  getUnitCodeFromMission,
  getUnitIdFromMission,
  isMissionActive,
  isProjectMission,
} from "@/lib/readinessChecklist";
import { getProjectDisplayName, getUnitDisplayName } from "@/lib/displayLabels";

const STATUS_OPTIONS = [
  { value: "unchecked", label: "Select" },
  { value: "checked", label: "Yes" },
  { value: "missing", label: "No" },
  { value: "some", label: "Some" },
  { value: "not_applicable", label: "N/A" },
] as const;

function inspectorName(user: any) {
  return user?.displayName || user?.name || user?.fullName || user?.email || "";
}

function statusTone(status: string) {
  if (status === "checked") return "border-emerald-500/30 bg-emerald-500/10";
  if (status === "some") return "border-amber-500/40 bg-amber-500/10";
  if (status === "missing" || status === "not_available") return "border-red-500/40 bg-red-500/10";
  return "border-white/10 bg-white/[0.03]";
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

type ValidationIssue = {
  itemId: string;
  label: string;
  message: string;
};

type ExtraStockPrompt = {
  action: "continue" | "submit";
  items: ReadinessChecklistItem[];
} | null;

function getExtraStockItems(items: ReadinessChecklistItem[]) {
  return items.filter((item) => {
    const minimum = Number(item.minQty || 0);
    const actual = Number(item.actualQty || 0);
    return item.status === "checked" && minimum > 0 && actual > minimum;
  });
}

function getValidationIssues(items: ReadinessChecklistItem[]) {
  const issues: ValidationIssue[] = [];

  items.forEach((item) => {
    if (item.status === "unchecked") {
      issues.push({
        itemId: item.id,
        label: item.label,
        message: `${item.label}: select Yes, No, Some, or N/A before continuing.`,
      });
      return;
    }

    const quantityMessage = quantityValidationMessage(item);
    if (quantityMessage) {
      issues.push({
        itemId: item.id,
        label: item.label,
        message: quantityMessage,
      });
    }
  });

  return issues;
}

function statusLabel(status: ReadinessChecklistItem["status"]) {
  if (status === "checked") return "Yes";
  if (status === "missing") return "No";
  if (status === "some") return "Some";
  if (status === "not_available") return "No";
  if (status === "not_applicable") return "N/A";
  return "Select";
}

function groupItems(items: ReadinessChecklistItem[]) {
  return items.reduce<Record<string, Record<string, ReadinessChecklistItem[]>>>(
    (acc, item) => {
      acc[item.section] = acc[item.section] || {};
      acc[item.section][item.group] = acc[item.section][item.group] || [];
      acc[item.section][item.group].push(item);
      return acc;
    },
    {}
  );
}

function ItemRow({
  item,
  hasIssue = false,
  onChange,
}: {
  item: ReadinessChecklistItem;
  hasIssue?: boolean;
  onChange: (patch: Partial<ReadinessChecklistItem>) => void;
}) {
  const needsQty = needsQuantity(item);

  return (
    <div
      id={`checklist-item-${item.id}`}
      className={`scroll-mt-28 rounded-xl border p-3 ${
        hasIssue ? "border-red-400 bg-red-500/10 ring-1 ring-red-400/50" : statusTone(item.status)
      }`}
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_190px_130px_1fr]">
        <div>
          <div className="font-semibold text-white">{item.label}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {vehicleSeverityBadge(item)}
            {item.critical && <span className="badge bg-rose-500/10 text-rose-200">V Item</span>}
            {item.manualVerify && <span className="badge bg-blue-500/10 text-blue-200">Manual</span>}
            {item.serviceLevels?.length ? (
              <span className="badge bg-amber-500/10 text-amber-200">
                {item.serviceLevels.join(", ")}
              </span>
            ) : null}
            {item.minQty && <span className="badge">Min {item.minQty}{item.unit ? ` ${item.unit}` : ""}</span>}
          </div>
        </div>

        <select
          className={`select ${hasIssue && item.status === "unchecked" ? "border-red-400 bg-red-500/10" : ""}`}
          value={item.status}
          onChange={(e) => {
            const status = e.target.value as ReadinessChecklistItem["status"];
            onChange({
              status,
              actualQty:
                status === "missing" || status === "not_available" || status === "not_applicable" || status === "unchecked"
                  ? undefined
                  : item.actualQty,
            });
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {needsQty ? (
          <input
            className={`input ${hasIssue && (item.status === "checked" || item.status === "some") ? "border-red-400 bg-red-500/10" : ""}`}
            type="number"
            min="0"
            step="any"
            value={item.actualQty ?? ""}
            onChange={(e) => {
              const rawValue = e.target.value.trim();
              if (rawValue === "") {
                onChange({ actualQty: undefined });
                return;
              }

              const nextQty = Number(rawValue);
              if (Number.isFinite(nextQty) && nextQty >= 0) {
                onChange({ actualQty: nextQty });
              }
            }}
            placeholder={item.inputType === "psi" ? "PSI" : item.inputType === "fuel" ? "%" : "Qty"}
          />
        ) : (
          <div className="hidden xl:block" />
        )}

        <input
          className="input"
          value={item.note || ""}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Note"
        />
      </div>
    </div>
  );
}

export default function NewProjectChecklistPage({
  params,
}: {
  params: { projectId: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionIdFromUrl = searchParams.get("missionId") || "";
  const checklistPhase = (searchParams.get("phase") === "closing" ? "closing" : "opening") as ChecklistPhase;
  const sourceChecklistId = searchParams.get("sourceChecklistId") || "";
  const isManualMode = params.projectId === "_manual" || searchParams.get("manual") === "1";
  const isB2CMode = params.projectId === "_b2c" || params.projectId === "b2c";
  const { user, loading: userLoading } = useCurrentUser();
  const { can, loading: permLoading } = usePermissions(user?.role);
  const [startedAtMs] = useState(() => Date.now());

  const [step, setStep] = useState(0);
  const [project, setProject] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [manualProjectName, setManualProjectName] = useState("");
  const [manualMissionLabel, setManualMissionLabel] = useState("");
  const [manualUnitId, setManualUnitId] = useState("");
  const [manualUnitCode, setManualUnitCode] = useState("");
  const [projectLoading, setProjectLoading] = useState(true);
  const [missions, setMissions] = useState<any[]>([]);
  const [missionId, setMissionId] = useState(missionIdFromUrl);
  const [shiftKey, setShiftKey] = useState("Day");
  const [serviceType, setServiceType] = useState<ServiceType>("BLS");
  const [deploymentType, setDeploymentType] = useState<DeploymentType>("Ambulance");
  const [dateKey, setDateKey] = useState(getRiyadhDateKey());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReadinessChecklistItem[]>(
    cloneDefaultChecklistItems("BLS", "Ambulance", checklistPhase)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [activeIssueItemId, setActiveIssueItemId] = useState("");
  const [extraStockPrompt, setExtraStockPrompt] = useState<ExtraStockPrompt>(null);
  const pageTopRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setProjectLoading(true);
    if (isManualMode || isB2CMode) {
      setProject(
        isB2CMode
          ? { id: "_b2c", projectName: "B2C Transport" }
          : { id: "_manual", projectName: "Manual Checklist" }
      );
      setProjectLoading(false);
      return;
    }
    getDoc(doc(db, "projects", params.projectId))
      .then((snap) => {
        setProject(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      })
      .finally(() => setProjectLoading(false));
  }, [params.projectId, isManualMode, isB2CMode]);

  useEffect(() => {
    if (!sourceChecklistId) return;
    getDoc(doc(db, "projectChecklists", sourceChecklistId)).then((snap) => {
      if (!snap.exists()) return;
      const source: any = snap.data();
      if (source.serviceType) setServiceType(source.serviceType);
      if (source.deploymentType) setDeploymentType(source.deploymentType);
      if (source.missionId) setMissionId(source.missionId);
      if (source.shiftKey) setShiftKey(source.shiftKey);
      if (source.dateKey) setDateKey(source.dateKey);
      if (source.projectName && isManualMode) setManualProjectName(source.projectName);
      if (source.missionLabel && isManualMode) setManualMissionLabel(source.missionLabel);
      if (source.unitId && isManualMode) setManualUnitId(source.unitId);
      if (source.unitCode && isManualMode) setManualUnitCode(source.unitCode);
    });
  }, [sourceChecklistId, isManualMode]);

  useEffect(() => {
    if (!isManualMode) return;
    getDocs(collection(db, "projects")).then((snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [isManualMode]);

  useEffect(() => {
    if (isManualMode || isB2CMode) {
      const unsub = onSnapshot(collection(db, "cases"), (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((mission) => {
            if (!isMissionActive(mission)) return false;
            const source = String(mission.sourceType || mission.caseType || "").toLowerCase();
            if (isB2CMode) return source.includes("b2c") && isProjectMission(mission);
            return isProjectMission(mission);
          });
        setMissions(rows);
      });
      return () => unsub();
    }

    const q = query(collection(db, "cases"), where("projectId", "==", params.projectId));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((mission) => {
          if (!isProjectMission(mission) || !isMissionActive(mission)) return false;
          if (mission.projectId !== params.projectId) return false;

          const projectUnitIds = new Set([
            ...(Array.isArray(project?.assignedAmbulanceIds) ? project.assignedAmbulanceIds : []),
            ...(Array.isArray(project?.assignedAmbulances)
              ? project.assignedAmbulances.map((unit: any) => unit?.id).filter(Boolean)
              : []),
          ]);
          if (projectUnitIds.size === 0) return true;
          return projectUnitIds.has(getUnitIdFromMission(mission));
        });
      setMissions(rows);
    });
    return () => unsub();
  }, [params.projectId, isManualMode, isB2CMode, project]);

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === missionId),
    [missions, missionId]
  );
  const wizardSteps = useMemo(
    () => getChecklistWizardSteps(deploymentType, checklistPhase),
    [deploymentType, checklistPhase]
  );
  const currentStepLabel = wizardSteps[step] || "Submit";

  useEffect(() => {
    setItems((current) => {
      const previousById = new Map(current.map((item) => [item.id, item]));
      return cloneDefaultChecklistItems(serviceType, deploymentType, checklistPhase).map((item) => ({
        ...item,
        status: previousById.get(item.id)?.status || item.status,
        ...(previousById.get(item.id)?.actualQty !== undefined
          ? { actualQty: previousById.get(item.id)?.actualQty }
          : {}),
        note: previousById.get(item.id)?.note || "",
      }));
    });
  }, [serviceType, deploymentType, checklistPhase]);

  useEffect(() => {
    if (step >= wizardSteps.length) {
      setStep(Math.max(0, wizardSteps.length - 1));
    }
  }, [step, wizardSteps.length]);

  useEffect(() => {
    pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const stepKey = getStepKeyForWizardLabel(currentStepLabel);
  const stepItems = useMemo(
    () => items.filter((item) => item.step === stepKey),
    [items, stepKey]
  );
  const grouped = useMemo(() => groupItems(stepItems), [stepItems]);
  const readiness = useMemo(() => calculateReadiness(items), [items]);
  const extraStockItems = useMemo(() => getExtraStockItems(items), [items]);
  const issueItemIds = useMemo(
    () => new Set(validationIssues.map((issue) => issue.itemId)),
    [validationIssues]
  );

  useEffect(() => {
    if (validationIssues.length === 0 || !activeIssueItemId) return;
    const currentIssues = getValidationIssues(stepItems);
    const currentIssueIds = new Set(currentIssues.map((issue) => issue.itemId));
    if (currentIssueIds.has(activeIssueItemId)) return;
    setValidationIssues(currentIssues);
    const nextIssue = currentIssues[0];
    if (nextIssue) {
      setActiveIssueItemId(nextIssue.itemId);
      window.setTimeout(() => scrollToChecklistItem(nextIssue.itemId), 120);
    } else {
      setActiveIssueItemId("");
    }
  }, [items, stepItems, validationIssues.length, activeIssueItemId]);

  function missionOptionLabel(mission: any) {
    return [
      getMissionLabel(mission),
      getUnitDisplayName({ unitCode: getUnitCodeFromMission(mission) }),
    ]
      .filter(Boolean)
      .join(" - ");
  }

  function updateItem(id: string, patch: Partial<ReadinessChecklistItem>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function scrollToChecklistItem(itemId: string) {
    document
      .getElementById(`checklist-item-${itemId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function getStepIndexForItem(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return step;
    const label = wizardSteps.find((entry) => getStepKeyForWizardLabel(entry) === item.step);
    return label ? wizardSteps.indexOf(label) : step;
  }

  function focusValidationIssue(issue: ValidationIssue) {
    setActiveIssueItemId(issue.itemId);
    const targetStep = getStepIndexForItem(issue.itemId);
    if (targetStep !== step) {
      setStep(targetStep);
      window.setTimeout(() => scrollToChecklistItem(issue.itemId), 250);
      return;
    }
    scrollToChecklistItem(issue.itemId);
  }

  function setStepValidationIssues(issues: ValidationIssue[]) {
    setValidationIssues(issues);
    setError(
      issues.length === 1
        ? "Fix this checklist item before continuing."
        : `Fix ${issues.length} checklist items before continuing.`
    );
    if (issues[0]) {
      setActiveIssueItemId(issues[0].itemId);
      const targetStep = getStepIndexForItem(issues[0].itemId);
      if (targetStep !== step) {
        setStep(targetStep);
      }
      window.setTimeout(() => scrollToChecklistItem(issues[0].itemId), 250);
    }
  }

  function showExtraStockPrompt(extraItems: ReadinessChecklistItem[], action: "continue" | "submit") {
    if (extraItems.length === 0) return false;
    setExtraStockPrompt({ action, items: extraItems });
    return true;
  }

  function reviewExtraStockInputs() {
    const firstItem = extraStockPrompt?.items[0];
    setExtraStockPrompt(null);
    if (firstItem) {
      focusValidationIssue({
        itemId: firstItem.id,
        label: firstItem.label,
        message: `${firstItem.label}: review the entered extra stock quantity.`,
      });
    }
  }

  function continueAfterExtraStockConfirm() {
    const action = extraStockPrompt?.action;
    setExtraStockPrompt(null);
    if (action === "continue") {
      setStep((current) => current + 1);
      return;
    }
    if (action === "submit") {
      void save("submitted", true);
    }
  }

  function checkStepEligible() {
    const ids = new Set(stepItems.map((item) => item.id));
    setItems((prev) =>
      checkAllEligibleItems(prev).map((item) =>
        ids.has(item.id) ? item : prev.find((old) => old.id === item.id) || item
      )
    );
  }

  function validateStep() {
    setError("");
    setValidationIssues([]);
    if (step === 0) {
      if (!shiftKey || !dateKey) {
        setError("Select Riyadh date and shift.");
        return false;
      }
      if (isManualMode) {
        if (!selectedProjectId && !manualProjectName.trim()) {
          setError("Select an existing project or enter a manual project name.");
          return false;
        }
        if (!missionId && !manualMissionLabel.trim()) {
          setError("Select a mission or enter a manual mission name.");
          return false;
        }
        if (!missionId && !manualUnitId.trim()) {
          setError("Enter the unit or ambulance code for the manual checklist.");
          return false;
        }
      } else if (!missionId) {
        setError("Select an active mission, Riyadh date, and shift.");
        return false;
      }
    }
    if (step === 1 && !serviceType) {
      setError("Select BLS, BLS+, ALS, or ALS+.");
      return false;
    }
    if (step === 2 && !deploymentType) {
      setError("Select Clinic, Ambulance, Ambulance + Clinic, or Walking Team.");
      return false;
    }
    if (stepItems.length > 0) {
      const issues = getValidationIssues(stepItems);
      if (issues.length > 0) {
        setStepValidationIssues(issues);
        return false;
      }

      if (showExtraStockPrompt(getExtraStockItems(stepItems), "continue")) return false;
    }
    return true;
  }

  async function save(status: "draft" | "submitted", skipExtraStockPrompt = false) {
    if (!user) return;
    if (!can("readiness_checklists", "create")) {
      alert("You do not have permission to create readiness checklists.");
      return;
    }
    if (status === "submitted" && !can("readiness_checklists", "submit")) {
      alert("You do not have permission to submit readiness checklists.");
      return;
    }
    const selectedProject = projects.find((entry) => entry.id === selectedProjectId);
    const resolvedProjectId = isManualMode
      ? selectedProjectId || "_manual"
      : isB2CMode
      ? "_b2c"
      : params.projectId;
    const resolvedProjectName = isManualMode
      ? selectedProject?.projectName || selectedProject?.name || manualProjectName.trim()
      : project?.projectName || selectedMission?.projectName || (isB2CMode ? "B2C Transport" : "");
    const resolvedMissionId =
      selectedMission?.id || `manual-${startedAtMs}`;
    const resolvedMissionLabel =
      selectedMission ? getMissionLabel(selectedMission) : manualMissionLabel.trim();
    const unitId = selectedMission ? getUnitIdFromMission(selectedMission) : manualUnitId.trim();
    const unitCode = selectedMission
      ? getUnitCodeFromMission(selectedMission)
      : manualUnitCode.trim() || manualUnitId.trim();
    if (!unitId) {
      alert("This mission does not have an assigned ambulance/unit.");
      return;
    }
    if (status === "submitted") {
      const issues = getValidationIssues(items);
      if (issues.length > 0) {
        setStepValidationIssues(issues);
        return;
      }

      if (!skipExtraStockPrompt && showExtraStockPrompt(getExtraStockItems(items), "submit")) {
        return;
      }
    }
    setSaving(true);
    try {
      const nowMs = Date.now();
      const durationSeconds = Math.max(1, Math.round((nowMs - startedAtMs) / 1000));
      const ref = await createReadinessChecklist(
        {
          projectId: resolvedProjectId,
          projectName: resolvedProjectName,
          missionId: resolvedMissionId,
          missionLabel: resolvedMissionLabel,
          unitId,
          unitCode,
          inspectorUserId: user.uid,
          inspectorName: inspectorName(user),
          inspectorEmployeeId: user.employeeId || user.employeeID || user.badgeNo || "",
          shiftKey,
          serviceType,
          deploymentType,
          checklistCategory: deploymentType,
          checklistPhase,
          sourceChecklistId,
          dateKey,
          notes,
          startedAtMs,
          submittedAtMs: status === "submitted" ? nowMs : undefined,
          durationSeconds,
          manualProjectName: isManualMode ? manualProjectName.trim() : undefined,
          manualMissionLabel: isManualMode ? manualMissionLabel.trim() : undefined,
          allowDuplicate: isManualMode,
          items,
        },
        status
      );
      router.push(`/projects/${resolvedProjectId}/checklists/${ref.id}`);
    } catch (saveError: any) {
      console.error(saveError);
      alert(saveError?.message || "Failed to save checklist.");
    } finally {
      setSaving(false);
    }
  }

  if (userLoading || permLoading || projectLoading) {
    return <div className="card-modern">Loading checklist wizard...</div>;
  }

  if (!project) {
    return (
      <div className="card-modern max-w-2xl">
        <h2 className="text-xl font-bold text-white">Project not found</h2>
        <p className="mt-2 text-slate-400">This readiness checklist needs a valid project.</p>
      </div>
    );
  }

  if (!can("readiness_checklists", "create")) {
    return (
      <div className="card-modern max-w-2xl">
        <h2 className="text-xl font-bold text-white">Access denied</h2>
        <p className="mt-2 text-slate-400">You do not have permission to create readiness checklists.</p>
      </div>
    );
  }

  return (
    <div ref={pageTopRef} className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            New EMS {checklistPhase === "closing" ? "Closing" : "Readiness"} Checklist
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Wizard based on Lazem medical readiness standards.
          </p>
        </div>
        <Link
          className="btn-secondary"
          href={isManualMode || isB2CMode ? "/missions" : `/projects/${params.projectId}/checklists`}
        >
          Back
        </Link>
      </div>

      <div className="card-modern overflow-x-auto">
        <div className="flex min-w-[760px] items-center gap-2">
          {wizardSteps.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                  index < step
                    ? "bg-emerald-500 text-white"
                    : index === step
                    ? "bg-blue-500 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {index < step ? "OK" : index + 1}
              </div>
              <span className={`text-xs font-bold ${index === step ? "text-white" : "text-slate-500"}`}>
                {label}
              </span>
              {index < wizardSteps.length - 1 && <div className="h-px flex-1 bg-white/10" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div ref={errorRef} className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {validationIssues.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-amber-100">Checklist items need attention</h3>
              <p className="mt-1 text-sm text-amber-100/80">
                Fix the listed items. After one is solved, the wizard will move you to the next issue.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-100">
              {validationIssues.length} item{validationIssues.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {validationIssues.map((issue) => (
              <div
                key={`${issue.itemId}-${issue.message}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3"
              >
                <div>
                  <div className="font-semibold text-white">{issue.label}</div>
                  <div className="text-sm text-amber-100/80">{issue.message}</div>
                </div>
                <button type="button" className="btn-secondary" onClick={() => focusValidationIssue(issue)}>
                  Go to item
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {extraStockPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-400/40 bg-slate-950 p-5 shadow-2xl shadow-blue-950/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">Extra stock entered</h3>
                <p className="mt-1 text-sm text-slate-300">
                  These quantities are above the checklist minimum. Confirm to continue, or review the inputs.
                </p>
              </div>
              <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-black text-blue-100">
                {extraStockPrompt.items.length} item{extraStockPrompt.items.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {extraStockPrompt.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div>
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="text-sm text-slate-400">
                      Entered {item.actualQty || 0} / Minimum {item.minQty}
                      {item.unit ? ` ${item.unit}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setExtraStockPrompt(null);
                      focusValidationIssue({
                        itemId: item.id,
                        label: item.label,
                        message: `${item.label}: review the entered extra stock quantity.`,
                      });
                    }}
                  >
                    Review item
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={reviewExtraStockInputs}>
                Need to review inputs
              </button>
              <button type="button" className="btn-primary" onClick={continueAfterExtraStockConfirm}>
                Confirm and continue
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 0 && (
        <section className="card-modern space-y-5">
          <div>
            <h3 className="text-lg font-black text-white">Info</h3>
            <p className="text-sm text-slate-400">
              Inspector details come from the logged-in HCAD account.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {isManualMode && (
              <>
                <label className="space-y-2 lg:col-span-2">
                  <span className="text-sm font-semibold text-slate-300">Project</span>
                  <select
                    className="select"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Manual project name</option>
                    {projects.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {getProjectDisplayName(entry)}
                      </option>
                    ))}
                  </select>
                </label>
                {!selectedProjectId && (
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-300">Manual Project Name</span>
                    <input
                      className="input"
                      value={manualProjectName}
                      onChange={(e) => setManualProjectName(e.target.value)}
                      placeholder="Project or coverage name"
                    />
                  </label>
                )}
              </>
            )}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-slate-400">Inspector</div>
              <div className="mt-1 font-bold text-white">{inspectorName(user) || "-"}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-slate-400">Employee ID</div>
              <div className="mt-1 font-bold text-white">
                {user?.employeeId || user?.employeeID || user?.badgeNo || "Not available"}
              </div>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-300">Riyadh Date</span>
              <input className="input" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
            </label>
            <label className="space-y-2 lg:col-span-2">
              <span className="text-sm font-semibold text-slate-300">Assigned Mission / Unit</span>
              <select className="select" value={missionId} onChange={(e) => setMissionId(e.target.value)}>
                <option value="">
                  {isManualMode ? "Optional: select active mission" : "Select active mission"}
                </option>
                {missions.map((mission) => (
                  <option key={mission.id} value={mission.id}>
                    {missionOptionLabel(mission)}
                  </option>
                ))}
              </select>
            </label>
            {isManualMode && !missionId && (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Manual Mission Name</span>
                  <input
                    className="input"
                    value={manualMissionLabel}
                    onChange={(e) => setManualMissionLabel(e.target.value)}
                    placeholder="Mission, task, or standby name"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Unit ID</span>
                  <input
                    className="input"
                    value={manualUnitId}
                    onChange={(e) => setManualUnitId(e.target.value)}
                    placeholder="Ambulance / clinic / team"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-300">Unit Display Code</span>
                  <input
                    className="input"
                    value={manualUnitCode}
                    onChange={(e) => setManualUnitCode(e.target.value)}
                    placeholder="Shown in dashboard"
                  />
                </label>
              </>
            )}
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-300">Shift</span>
              <select className="select" value={shiftKey} onChange={(e) => setShiftKey(e.target.value)}>
                {SHIFT_OPTIONS.map((shift) => (
                  <option key={shift} value={shift}>{shift}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {currentStepLabel === "Service" && (
        <section className="card-modern space-y-5">
          <div>
            <h3 className="text-lg font-black text-white">Service</h3>
            <p className="text-sm text-slate-400">The selected service level controls the official checklist items for this category.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {SERVICE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setServiceType(type)}
                className={`rounded-xl border p-6 text-left transition ${
                  serviceType === type ? "border-blue-400 bg-blue-500/10" : "border-white/10 bg-white/[0.03] hover:border-blue-400/60"
                }`}
              >
                <div className="text-2xl font-black text-white">{type}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {getServiceDescription(type)}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {currentStepLabel === "Deploy" && (
        <section className="card-modern space-y-5">
          <div>
            <h3 className="text-lg font-black text-white">Deploy</h3>
            <p className="text-sm text-slate-400">The category controls the wizard path and which official standards are loaded.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {DEPLOYMENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDeploymentType(type)}
                className={`rounded-xl border p-6 text-left transition ${
                  deploymentType === type ? "border-blue-400 bg-blue-500/10" : "border-white/10 bg-white/[0.03] hover:border-blue-400/60"
                }`}
              >
                <div className="text-xl font-black text-white">{type}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {type === "Ambulance"
                    ? "Opening, vehicle, red bag, medication, and kit readiness."
                    : type === "Ambulance + Clinic"
                    ? "Opening, vehicle, clinic, red bag, and medication readiness."
                    : type === "Clinic"
                    ? "Opening, clinic room, supplies, red bag, and medications."
                    : "Walking team, vest, oxygen, red bag, and medication readiness."}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {stepItems.length > 0 && currentStepLabel !== "Submit" && (
        <section className="space-y-4">
          <div className="card-modern flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">{currentStepLabel}</h3>
              <p className="text-sm text-slate-400">
                Critical and manual items must be answered individually. Check All Eligible skips them.
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={checkStepEligible}>
              Check All Eligible
            </button>
          </div>

          {Object.entries(grouped).map(([section, groups]) => (
            <div key={section} className="card-modern space-y-4">
              <h4 className="text-base font-black text-white">{section}</h4>
              {Object.entries(groups).map(([group, groupItems]) => (
                <div key={group} className="space-y-2">
                  <h5 className="text-sm font-bold uppercase tracking-wide text-slate-400">{group}</h5>
                  {groupItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      hasIssue={issueItemIds.has(item.id)}
                      onChange={(patch) => updateItem(item.id, patch)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {currentStepLabel === "Submit" && (
        <section className="space-y-4">
          <div className="card-modern grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-slate-400">Result</div>
              <div className="mt-1 text-2xl font-black text-white">{readiness.result}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Readiness Score</div>
              <div className="mt-1 text-2xl font-black text-white">{readiness.readinessScore}%</div>
            </div>
            <div>
              <div className="text-sm text-slate-400">No / Some</div>
              <div className="mt-1 text-2xl font-black text-white">
                {readiness.missingItems.length} / {readiness.someItems.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Vehicle Red / Shortages</div>
              <div className="mt-1 text-2xl font-black text-white">
                {readiness.vehicleRedIssues.length} / {readiness.shortageIssues.length}
              </div>
            </div>
          </div>

          <div className="card-modern">
            <h3 className="font-black text-white">Issue Summary</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {[
                ...readiness.vehicleRedIssues,
                ...readiness.vehicleYellowIssues,
                ...readiness.criticalIssues,
                ...readiness.missingItems,
                ...readiness.unavailableItems,
                ...readiness.insufficientQuantityItems,
              ]
                .filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index)
                .map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {statusLabel(item.status)}
                      {item.minQty ? ` / ${item.actualQty || 0} of ${item.minQty}${item.unit ? ` ${item.unit}` : ""}` : ""}
                    </div>
                  </div>
                ))}
              {readiness.readinessScore === 100 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100">
                  No readiness issues found.
                </div>
              )}
            </div>
          </div>

          {extraStockItems.length > 0 && (
            <div className="card-modern border-blue-500/30 bg-blue-500/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-white">Extra Stock</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    These quantities are above the checklist minimum and will be submitted as recorded.
                  </p>
                </div>
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-black text-blue-100">
                  {extraStockItems.length} item{extraStockItems.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {extraStockItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Entered {item.actualQty || 0} / Minimum {item.minQty}
                      {item.unit ? ` ${item.unit}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="card-modern block space-y-2">
            <span className="text-sm font-semibold text-slate-300">Checklist Notes</span>
            <textarea className="input min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="btn-secondary"
          disabled={step === 0 || saving}
          onClick={() => {
            setError("");
            setStep((current) => Math.max(0, current - 1));
          }}
        >
          Back
        </button>

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={saving || !selectedMission} onClick={() => save("draft")}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          {currentStepLabel !== "Submit" ? (
            <button
              className="btn-primary"
              disabled={saving}
              onClick={() => {
                if (validateStep()) setStep((current) => current + 1);
              }}
            >
              Continue
            </button>
          ) : (
            <button className="btn-primary" disabled={saving || !selectedMission} onClick={() => save("submitted")}>
              {saving ? "Submitting..." : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
