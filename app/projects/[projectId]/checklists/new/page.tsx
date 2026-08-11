"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { usePermissions } from "@/lib/usePermissions";
import {
  DEPLOYMENT_TYPES,
  DeploymentType,
  ChecklistPhase,
  READINESS_ACKNOWLEDGEMENT_TEXT,
  READINESS_POLICIES_URL,
  SERVICE_TYPES,
  ResolvedProjectShift,
  ServiceType,
  ReadinessChecklistItem,
  calculateReadiness,
  checkAllEligibleItems,
  cloneDefaultChecklistItems,
  createReadinessChecklist,
  doesChecklistShiftMatch,
  findDuplicateChecklist,
  getServiceDescription,
  getChecklistWizardSteps,
  getStepKeyForWizardLabel,
  getRiyadhDateKey,
  getProjectReadinessSettings,
  getUnitCodeFromMission,
  getUnitIdFromMission,
  isMissionActive,
  isProjectMission,
  normalizeDeploymentType,
  resolveCurrentProjectShift,
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
  if (status === "checked") return "border-emerald-500/30 bg-emerald-50";
  if (status === "some") return "border-amber-500/40 bg-amber-50";
  if (status === "missing" || status === "not_available") return "border-red-500/40 bg-red-50";
  return "border-[#86A7B2]/25 bg-white";
}

function vehicleSeverityBadge(item: ReadinessChecklistItem) {
  if (item.vehicleSeverity === "red") {
    return <span className="badge border-red-500/20 bg-red-500/10 text-red-700">Red Vehicle</span>;
  }
  if (item.vehicleSeverity === "yellow") {
    return <span className="badge border-amber-500/20 bg-amber-500/10 text-amber-700">Yellow Vehicle</span>;
  }
  if (item.vehicleSeverity === "green") {
    return <span className="badge border-emerald-500/20 bg-emerald-500/10 text-emerald-700">Green Vehicle</span>;
  }
  return null;
}

function needsQuantity(item: ReadinessChecklistItem) {
  return Boolean(item.minQty || item.inputType === "fuel" || item.inputType === "psi");
}

function needsIdentifier(item: ReadinessChecklistItem) {
  return item.inputType === "code" || item.inputType === "seal";
}

function identifierPlaceholder(item: ReadinessChecklistItem) {
  if (item.inputType === "seal") return "Seal number";
  return "Code / serial number";
}

function statusPatch(
  item: ReadinessChecklistItem,
  status: ReadinessChecklistItem["status"]
): Partial<ReadinessChecklistItem> {
  if (
    status === "missing" ||
    status === "not_available" ||
    status === "not_applicable" ||
    status === "unchecked"
  ) {
    return { status, actualQty: undefined, identifierValue: "" };
  }

  if (status === "checked" && needsQuantity(item) && Number(item.minQty || 0) > 0) {
    return { status, actualQty: Number(item.minQty) };
  }

  return { status, actualQty: item.actualQty };
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

function identifierValidationMessage(item: ReadinessChecklistItem) {
  if (!needsIdentifier(item) || (item.status !== "checked" && item.status !== "some")) return "";
  if (!String(item.identifierValue || "").trim()) {
    return `${item.label}: enter ${item.inputType === "seal" ? "seal number" : "code / serial number"}.`;
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

function isChecklistComplete(checklist: any) {
  const status = String(checklist?.status || "").toLowerCase();
  return status === "submitted" || status === "approved";
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

    const identifierMessage = identifierValidationMessage(item);
    if (identifierMessage) {
      issues.push({
        itemId: item.id,
        label: item.label,
        message: identifierMessage,
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

function getUnitIdFromRecord(unit: any) {
  return String(
    unit?.id ||
      unit?.unitId ||
      unit?.ambulanceId ||
      unit?.code ||
      unit?.unitCode ||
      unit?.ambulanceCode ||
      ""
  ).trim();
}

function getUnitCodeFromRecord(unit: any) {
  return String(
    unit?.unitCode ||
      unit?.code ||
      unit?.ambulanceCode ||
      unit?.vehicleCode ||
      unit?.callSign ||
      unit?.name ||
      getUnitIdFromRecord(unit)
  ).trim();
}

function getUnitOptionLabel(unit: any) {
  const unitCode = getUnitCodeFromRecord(unit);
  return getUnitDisplayName({ unitCode, unitId: getUnitIdFromRecord(unit) }) || unitCode || "Unknown unit";
}

function getProjectAssignedUnitIds(project: any) {
  const ids = new Set<string>();

  [
    ...(Array.isArray(project?.assignedAmbulanceIds) ? project.assignedAmbulanceIds : []),
    ...(Array.isArray(project?.ambulanceIds) ? project.ambulanceIds : []),
    ...(Array.isArray(project?.unitIds) ? project.unitIds : []),
  ].forEach((id) => {
    if (id) ids.add(String(id).trim());
  });

  if (Array.isArray(project?.assignedAmbulances)) {
    project.assignedAmbulances.forEach((unit: any) => {
      const id = typeof unit === "string" ? unit : getUnitIdFromRecord(unit);
      if (id) ids.add(String(id).trim());
    });
  }

  return ids;
}

function getUnitAssignedUserIds(unit: any) {
  const ids = new Set<string>();

  [
    ...(Array.isArray(unit?.assignedUserIds) ? unit.assignedUserIds : []),
    ...(Array.isArray(unit?.crewUserIds) ? unit.crewUserIds : []),
  ].forEach((id) => {
    if (id) ids.add(String(id).trim());
  });

  if (Array.isArray(unit?.crewMembers)) {
    unit.crewMembers.forEach((member: any) => {
      if (member?.userId) ids.add(String(member.userId).trim());
    });
  }

  return ids;
}

function getUserUnitIds(user: any) {
  return new Set(
    [
      ...(Array.isArray(user?.ambulanceIds) ? user.ambulanceIds : []),
      ...(Array.isArray(user?.assignedAmbulanceIds) ? user.assignedAmbulanceIds : []),
      ...(Array.isArray(user?.unitIds) ? user.unitIds : []),
    ]
      .filter(Boolean)
      .map((id) => String(id).trim())
  );
}

function mergeUnitOptions(...groups: any[][]) {
  const seen = new Set<string>();
  const options: any[] = [];

  groups.flat().forEach((unit) => {
    const id = getUnitIdFromRecord(unit);
    if (!id || seen.has(id)) return;
    seen.add(id);
    options.push(unit);
  });

  return options.sort((a, b) => getUnitOptionLabel(a).localeCompare(getUnitOptionLabel(b)));
}

function getChecklistCreatedMs(checklist: any) {
  return (
    checklist?.submittedAtMs ||
    checklist?.startedAtMs ||
    checklist?.createdAt?.toDate?.()?.getTime?.() ||
    0
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
      className={`scroll-mt-28 rounded-xl border p-3 shadow-sm shadow-[#274C5A]/5 ${
        hasIssue ? "border-red-400 bg-red-50 ring-2 ring-red-400/30" : statusTone(item.status)
      }`}
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_280px_130px_220px_1fr]">
        <div>
          <div className="font-bold text-[#274C5A]">{item.label}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {vehicleSeverityBadge(item)}
            {item.critical && <span className="badge border-rose-500/20 bg-rose-500/10 text-rose-700">V Item</span>}
            {item.manualVerify && <span className="badge border-[#274C5A]/20 bg-[#274C5A]/10 text-[#274C5A]">Manual</span>}
            {item.minQty && <span className="badge">Min {item.minQty}{item.unit ? ` ${item.unit}` : ""}</span>}
          </div>
        </div>

        <div
          className={`grid grid-cols-2 gap-2 rounded-2xl border bg-white p-1 ${
            hasIssue && item.status === "unchecked" ? "border-red-400 bg-red-50" : "border-[#c8dce2]"
          }`}
        >
          {STATUS_OPTIONS.filter((option) => option.value !== "unchecked").map((option) => {
            const selected =
              item.status === option.value ||
              (item.status === "not_available" && option.value === "missing");

            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange(
                    statusPatch(
                      item,
                      option.value as ReadinessChecklistItem["status"]
                    )
                  )
                }
                className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                  selected
                    ? "bg-[#274C5A] text-white shadow-sm"
                    : "bg-[#f7fbfc] text-[#274C5A] hover:bg-[#eaf3f6]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {needsQty ? (
          <input
            className={`input ${hasIssue && (item.status === "checked" || item.status === "some") ? "border-red-400 bg-red-50" : ""}`}
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

        {needsIdentifier(item) ? (
          <input
            className={`input ${hasIssue && (item.status === "checked" || item.status === "some") ? "border-red-400 bg-red-50" : ""}`}
            value={item.identifierValue || ""}
            onChange={(e) => onChange({ identifierValue: e.target.value })}
            placeholder={identifierPlaceholder(item)}
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
  const checklistPhase = (searchParams.get("phase") === "closing" ? "closing" : "opening") as ChecklistPhase;
  const sourceChecklistId = searchParams.get("sourceChecklistId") || "";
  const unitIdFromUrl = searchParams.get("unitId") || "";
  const shiftFromUrl = searchParams.get("shift") || "Day";
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
  const [manualUnitId, setManualUnitId] = useState("");
  const [manualUnitCode, setManualUnitCode] = useState("");
  const [projectLoading, setProjectLoading] = useState(true);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [projectMissionUnits, setProjectMissionUnits] = useState<any[]>([]);
  const [projectChecklists, setProjectChecklists] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState(unitIdFromUrl);
  const [shiftKey, setShiftKey] = useState(shiftFromUrl);
  const [resolvedShift, setResolvedShift] = useState<ResolvedProjectShift>(() =>
    resolveCurrentProjectShift(undefined)
  );
  const [serviceType, setServiceType] = useState<ServiceType>("BLS");
  const [deploymentType, setDeploymentType] = useState<DeploymentType>("Ambulance");
  const [dateKey, setDateKey] = useState(getRiyadhDateKey());
  const [notes, setNotes] = useState("");
  const [submitAcknowledged, setSubmitAcknowledged] = useState(false);
  const [items, setItems] = useState<ReadinessChecklistItem[]>(
    cloneDefaultChecklistItems("BLS", "Ambulance", checklistPhase)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [activeIssueItemId, setActiveIssueItemId] = useState("");
  const [extraStockPrompt, setExtraStockPrompt] = useState<ExtraStockPrompt>(null);
  const [unitSelectionTouched, setUnitSelectionTouched] = useState(false);
  const [selectedUnitClosedChecklist, setSelectedUnitClosedChecklist] = useState<any>(null);
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
      if (source.shiftKey) setShiftKey(source.shiftKey);
      if (source.dateKey) setDateKey(source.dateKey);
      if (source.shiftId || source.shiftKey) {
        setResolvedShift({
          shiftId: source.shiftId || source.shiftKey || "shift",
          shiftKey: source.shiftKey || source.shiftName || "Shift",
          shiftName: source.shiftName || source.shiftKey || "Shift",
          shiftDate: source.shiftDate || source.dateKey || getRiyadhDateKey(),
          shiftStartTime: source.shiftStartTime || "--:--",
          shiftEndTime: source.shiftEndTime || "--:--",
          crossesMidnight: Boolean(source.crossesMidnight),
        });
      }
      if (source.projectName && isManualMode) setManualProjectName(source.projectName);
      if (source.unitId) setSelectedUnitId(source.unitId);
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
    const unsub = onSnapshot(
      collection(db, "ambulances"),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((unit) => !unit.archived && !unit.disabled);
        setAmbulances(rows);
      },
      (loadError) => {
        console.error("Failed to load ambulances for readiness checklist", loadError);
        setAmbulances([]);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "projectChecklists"),
      (snap) => {
        setProjectChecklists(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setProjectChecklists([])
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    const targetProjectId = isManualMode ? selectedProjectId : params.projectId;
    if (!targetProjectId || targetProjectId.startsWith("_") || isB2CMode) {
      setProjectMissionUnits([]);
      return;
    }

    const unsub = onSnapshot(
      collection(db, "cases"),
      (snap) => {
        const missionUnits = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((mission) => {
            const missionProjectId = mission.projectId || mission.assignedProjectId || "";
            return (
              missionProjectId === targetProjectId &&
              isProjectMission(mission) &&
              isMissionActive(mission)
            );
          })
          .map((mission) => {
            const unitId = getUnitIdFromMission(mission);
            const unitCode = getUnitCodeFromMission(mission) || unitId;
            return unitId
              ? {
                  id: unitId,
                  unitId,
                  unitCode,
                  code: unitCode,
                  source: "mission",
                }
              : null;
          })
          .filter(Boolean) as any[];

        setProjectMissionUnits(missionUnits);
      },
      () => setProjectMissionUnits([])
    );

    return () => unsub();
  }, [isB2CMode, isManualMode, params.projectId, selectedProjectId]);

  const selectedExistingProject = useMemo(
    () => projects.find((entry) => entry.id === selectedProjectId),
    [projects, selectedProjectId]
  );
  const projectForUnitDetection =
    isManualMode && selectedExistingProject ? selectedExistingProject : project;

  useEffect(() => {
    if (sourceChecklistId && checklistPhase === "closing") return;
    const nextShift = resolveCurrentProjectShift(projectForUnitDetection?.shiftSchedule);
    setResolvedShift(nextShift);
    setShiftKey(nextShift.shiftName);
    setDateKey(nextShift.shiftDate);
  }, [checklistPhase, projectForUnitDetection, sourceChecklistId]);

  const unitOptions = useMemo(() => {
    const assignedUnitIds = getProjectAssignedUnitIds(projectForUnitDetection);
    const embeddedProjectUnits = Array.isArray(projectForUnitDetection?.assignedAmbulances)
      ? projectForUnitDetection.assignedAmbulances.map((unit: any) =>
          typeof unit === "string" ? { id: unit, unitId: unit, unitCode: unit } : unit
        )
      : [];
    const projectUnits =
      assignedUnitIds.size > 0
        ? ambulances.filter((unit) => assignedUnitIds.has(getUnitIdFromRecord(unit)))
        : ambulances;

    return mergeUnitOptions(projectUnits, embeddedProjectUnits, projectMissionUnits);
  }, [ambulances, projectForUnitDetection, projectMissionUnits]);
  const selectedUnit = useMemo(
    () => unitOptions.find((unit) => getUnitIdFromRecord(unit) === selectedUnitId),
    [unitOptions, selectedUnitId]
  );
  const selectedUnitCode = selectedUnit ? getUnitCodeFromRecord(selectedUnit) : selectedUnitId;
  const assignedUnitDisplay = selectedUnit
    ? getUnitOptionLabel(selectedUnit)
    : selectedUnitId
    ? getUnitDisplayName({ unitCode: selectedUnitId, unitId: selectedUnitId }) || selectedUnitId
    : unitOptions.length > 0
    ? "Not detected for this user"
    : "No project unit found";
  const canSaveChecklist = isManualMode
    ? Boolean(manualUnitId.trim())
    : Boolean(selectedUnitId) && !selectedUnitClosedChecklist;
  const shouldShowProjectUnitPicker =
    unitOptions.length > 1 && (!isManualMode || Boolean(selectedProjectId));
  const shouldRequireProjectUnitSelection =
    shouldShowProjectUnitPicker && !unitIdFromUrl && !sourceChecklistId;
  const hasLockedUnitContext = Boolean(unitIdFromUrl || sourceChecklistId);
  const shouldAllowProjectUnitPicker = shouldShowProjectUnitPicker && !hasLockedUnitContext;
  const canReturnToUnitSelection =
    shouldShowProjectUnitPicker && hasLockedUnitContext && !isManualMode;
  const readinessUnitCards = useMemo(() => {
    const normalizedDeployment = normalizeDeploymentType(deploymentType);
    const projectIdForChecklist = isManualMode ? selectedProjectId : params.projectId;

    return unitOptions.map((unit) => {
      const unitId = getUnitIdFromRecord(unit);
      const relevant = projectChecklists
        .filter((entry) => {
          if (!unitId || entry.unitId !== unitId) return false;
          if (projectIdForChecklist && entry.projectId && entry.projectId !== projectIdForChecklist) return false;
          if (entry.dateKey !== dateKey) return false;
          if (!doesChecklistShiftMatch(entry, shiftKey, resolvedShift.shiftId)) return false;
          return (
            normalizeDeploymentType(entry.deploymentType || entry.checklistCategory || "Ambulance") ===
            normalizedDeployment
          );
        })
        .sort((a, b) => getChecklistCreatedMs(b) - getChecklistCreatedMs(a));
      const opening = relevant.find((entry) => (entry.checklistPhase || "opening") === "opening");
      const closing = relevant.find((entry) => (entry.checklistPhase || "opening") === "closing");
      const openingDone = isChecklistComplete(opening);
      const closingDone = isChecklistComplete(closing);

      return {
        unit,
        unitId,
        unitLabel: getUnitOptionLabel(unit),
        opening,
        closing,
        openingDone,
        closingDone,
      };
    });
  }, [
    dateKey,
    deploymentType,
    isManualMode,
    params.projectId,
    projectChecklists,
    resolvedShift.shiftId,
    selectedProjectId,
    shiftKey,
    unitOptions,
  ]);
  const usesAutomaticReadinessSettings = Boolean(projectForUnitDetection);
  const wizardSteps = useMemo(() => {
    const steps = getChecklistWizardSteps(deploymentType, checklistPhase);
    if (!usesAutomaticReadinessSettings) return steps;
    return steps.filter((label) => label !== "Service" && label !== "Deploy");
  }, [checklistPhase, deploymentType, usesAutomaticReadinessSettings]);
  const currentStepLabel = wizardSteps[step] || "Submit";

  useEffect(() => {
    if (!usesAutomaticReadinessSettings) return;
    const settings = getProjectReadinessSettings(projectForUnitDetection, selectedUnitId);
    setServiceType(settings.serviceType);
    setDeploymentType(settings.deploymentType);
  }, [projectForUnitDetection, selectedUnitId, usesAutomaticReadinessSettings]);

  useEffect(() => {
    if (!unitIdFromUrl || selectedUnitId === unitIdFromUrl) return;
    const unit = unitOptions.find((option) => getUnitIdFromRecord(option) === unitIdFromUrl);
    setSelectedUnitId(unitIdFromUrl);
    setUnitSelectionTouched(true);
    if (isManualMode && selectedProjectId) {
      setManualUnitId(unitIdFromUrl);
      setManualUnitCode(unit ? getUnitCodeFromRecord(unit) : unitIdFromUrl);
    }
  }, [isManualMode, selectedProjectId, selectedUnitId, unitIdFromUrl, unitOptions]);

  useEffect(() => {
    if (!shouldRequireProjectUnitSelection || unitSelectionTouched || !selectedUnitId) return;
    setSelectedUnitId("");
    if (isManualMode && selectedProjectId) {
      setManualUnitId("");
      setManualUnitCode("");
    }
  }, [
    isManualMode,
    selectedProjectId,
    selectedUnitId,
    shouldRequireProjectUnitSelection,
    unitSelectionTouched,
  ]);

  useEffect(() => {
    if (isManualMode || selectedUnitId || unitOptions.length === 0) return;
    if (!unitIdFromUrl && unitOptions.length > 1) return;

    const userUnitIds = getUserUnitIds(user);
    const userUnit = unitOptions.find((unit) => {
      const unitId = getUnitIdFromRecord(unit);
      if (userUnitIds.has(unitId)) return true;
      return user?.uid && getUnitAssignedUserIds(unit).has(user.uid);
    });

    const automaticUnit = userUnit || (unitOptions.length === 1 ? unitOptions[0] : null);
    if (automaticUnit) setSelectedUnitId(getUnitIdFromRecord(automaticUnit));
  }, [isManualMode, selectedUnitId, unitIdFromUrl, unitOptions, user]);

  useEffect(() => {
    if (!isManualMode || !selectedProjectId || unitOptions.length === 0) return;
    if (!unitIdFromUrl && unitOptions.length > 1) return;

    const userUnitIds = getUserUnitIds(user);
    const userUnit = unitOptions.find((unit) => {
      const unitId = getUnitIdFromRecord(unit);
      if (userUnitIds.has(unitId)) return true;
      return user?.uid && getUnitAssignedUserIds(unit).has(user.uid);
    });
    const automaticUnit = userUnit || (unitOptions.length === 1 ? unitOptions[0] : null);
    if (!automaticUnit) return;

    const unitId = getUnitIdFromRecord(automaticUnit);
    const unitCode = getUnitCodeFromRecord(automaticUnit) || unitId;
    setSelectedUnitId(unitId);
    setManualUnitId(unitId);
    setManualUnitCode(unitCode);
  }, [isManualMode, selectedProjectId, unitIdFromUrl, unitOptions, user]);

  useEffect(() => {
    setItems((current) => {
      const previousById = new Map(current.map((item) => [item.id, item]));
      return cloneDefaultChecklistItems(serviceType, deploymentType, checklistPhase).map((item) => ({
        ...item,
        status: previousById.get(item.id)?.status || item.status,
        ...(previousById.get(item.id)?.actualQty !== undefined
          ? { actualQty: previousById.get(item.id)?.actualQty }
          : {}),
        identifierValue: previousById.get(item.id)?.identifierValue || "",
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
    if (
      (isManualMode && !selectedProjectId) ||
      shouldRequireProjectUnitSelection ||
      !selectedUnitId ||
      !dateKey ||
      !shiftKey ||
      !deploymentType
    ) {
      return;
    }

    let cancelled = false;

    async function enforceOpeningSequence() {
      const existingClosing = await findDuplicateChecklist(
        selectedUnitId,
        dateKey,
        shiftKey,
        deploymentType,
        "closing",
        resolvedShift.shiftId
      );

      if (cancelled) return;

      if (existingClosing) {
        if (!unitIdFromUrl && unitSelectionTouched && shouldShowProjectUnitPicker) return;
        const existing = existingClosing as any;
        router.replace(`/projects/${existing.projectId || params.projectId}/checklists/${existing.id}`);
        return;
      }

      if (checklistPhase === "closing") return;

      const existingOpening = await findDuplicateChecklist(
        selectedUnitId,
        dateKey,
        shiftKey,
        deploymentType,
        "opening",
        resolvedShift.shiftId
      );

      if (cancelled || !existingOpening) return;

      const existing = existingOpening as any;
      if (isChecklistComplete(existing)) {
        const redirectParams = new URLSearchParams({
          unitId: selectedUnitId,
          shift: shiftKey,
          phase: "closing",
          sourceChecklistId: existing.id,
        });
        router.replace(`/projects/${existing.projectId || params.projectId}/checklists/new?${redirectParams.toString()}`);
        return;
      }

      router.replace(`/projects/${existing.projectId || params.projectId}/checklists/${existing.id}`);
    }

    void enforceOpeningSequence();

    return () => {
      cancelled = true;
    };
  }, [checklistPhase, dateKey, deploymentType, isManualMode, params.projectId, resolvedShift.shiftId, router, selectedProjectId, selectedUnitId, shiftKey, shouldRequireProjectUnitSelection, shouldShowProjectUnitPicker, unitIdFromUrl, unitSelectionTouched]);

  useEffect(() => {
    setSelectedUnitClosedChecklist(null);
    if (
      (isManualMode && !selectedProjectId) ||
      shouldRequireProjectUnitSelection ||
      !selectedUnitId ||
      !dateKey ||
      !shiftKey ||
      !deploymentType
    ) {
      return;
    }

    let cancelled = false;

    async function checkSelectedUnitCompletion() {
      const existingClosing = await findDuplicateChecklist(
        selectedUnitId,
        dateKey,
        shiftKey,
        deploymentType,
        "closing",
        resolvedShift.shiftId
      );

      if (!cancelled) setSelectedUnitClosedChecklist(existingClosing || null);
    }

    void checkSelectedUnitCompletion();

    return () => {
      cancelled = true;
    };
  }, [dateKey, deploymentType, isManualMode, resolvedShift.shiftId, selectedProjectId, selectedUnitId, shiftKey, shouldRequireProjectUnitSelection]);

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
  const cardClass = "rounded-2xl border border-[#86A7B2]/25 bg-white p-5 shadow-sm shadow-[#274C5A]/5";
  const metricCardClass = "rounded-xl border border-[#86A7B2]/25 bg-[#f8fbfc] p-4";
  const labelClass = "text-sm font-bold text-[#274C5A]";
  const mutedTextClass = "text-sm text-[#7F7F7F]";
  const primaryButtonClass =
    "inline-flex items-center justify-center rounded-xl bg-[#274C5A] px-4 py-2.5 text-sm font-black text-white shadow-sm shadow-[#274C5A]/20 transition hover:bg-[#1f3f4c] disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButtonClass =
    "inline-flex items-center justify-center rounded-xl border border-[#86A7B2]/35 bg-white px-4 py-2.5 text-sm font-bold text-[#274C5A] transition hover:border-[#274C5A]/40 hover:bg-[#f8fbfc] disabled:cursor-not-allowed disabled:opacity-50";
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
        if (!manualUnitId.trim()) {
          setError("Enter the unit or ambulance code for the manual checklist.");
          return false;
        }
      } else if (!selectedUnitId) {
        setError("No assigned unit was detected for your account in this project. Contact the control room or project admin.");
        return false;
      }
    }
    if (currentStepLabel === "Service" && !serviceType) {
      setError("Select BLS, BLS+, ALS, or ALS+.");
      return false;
    }
    if (currentStepLabel === "Deploy" && !deploymentType) {
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
    if (status === "submitted" && !submitAcknowledged) {
      alert("Please confirm the submission acknowledgement before submitting.");
      return;
    }
    const resolvedProjectId = isManualMode
      ? selectedProjectId || "_manual"
      : isB2CMode
      ? "_b2c"
      : params.projectId;
    const resolvedProjectName = isManualMode
      ? selectedExistingProject?.projectName || selectedExistingProject?.name || manualProjectName.trim()
      : project?.projectName || project?.name || (isB2CMode ? "B2C Transport" : "");
    const unitId = isManualMode
      ? manualUnitId.trim()
      : selectedUnitId;
    const unitCode = isManualMode
      ? manualUnitCode.trim() || manualUnitId.trim()
      : selectedUnitCode || unitId;
    if (!unitId) {
      alert("Select the assigned unit or ambulance before saving the checklist.");
      return;
    }
    if (!isManualMode || selectedProjectId) {
      const existingChecklist = await findDuplicateChecklist(
        unitId,
        dateKey,
        shiftKey,
        deploymentType,
        checklistPhase,
        resolvedShift.shiftId
      );
      if (existingChecklist) {
        const existing = existingChecklist as any;
        router.push(`/projects/${existing.projectId || resolvedProjectId}/checklists/${existing.id}`);
        return;
      }
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
          unitId,
          unitCode,
          inspectorUserId: user.uid,
          inspectorName: inspectorName(user),
          inspectorEmployeeId: user.employeeId || user.employeeID || user.badgeNo || "",
          shiftId: resolvedShift.shiftId,
          shiftKey,
          shiftName: resolvedShift.shiftName,
          shiftDate: resolvedShift.shiftDate,
          shiftStartTime: resolvedShift.shiftStartTime,
          shiftEndTime: resolvedShift.shiftEndTime,
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
          submissionAcknowledgement:
            status === "submitted"
              ? {
                  acknowledged: true,
                  acknowledgedAtMs: nowMs,
                  acknowledgedBy: user.uid,
                  acknowledgedByName: inspectorName(user),
                  text: READINESS_ACKNOWLEDGEMENT_TEXT,
                  policiesUrl: READINESS_POLICIES_URL,
                }
              : undefined,
          manualProjectName: isManualMode ? manualProjectName.trim() : undefined,
          allowDuplicate: isManualMode && !selectedProjectId,
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
    return <div className={cardClass}>Loading checklist wizard...</div>;
  }

  if (!project) {
    return (
      <div className={`${cardClass} max-w-2xl`}>
        <h2 className="text-xl font-black text-[#274C5A]">Project not found</h2>
        <p className="mt-2 text-[#7F7F7F]">This readiness checklist needs a valid project.</p>
      </div>
    );
  }

  if (!can("readiness_checklists", "create")) {
    return (
      <div className={`${cardClass} max-w-2xl`}>
        <h2 className="text-xl font-black text-[#274C5A]">Access denied</h2>
        <p className="mt-2 text-[#7F7F7F]">You do not have permission to create readiness checklists.</p>
      </div>
    );
  }

  return (
    <div ref={pageTopRef} className="mx-auto max-w-7xl space-y-5">
      <div className="rounded-2xl bg-[#274C5A] p-5 text-white shadow-sm shadow-[#274C5A]/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide">
            HCAD Readiness
          </div>
          <h2 className="text-xl font-black text-white">
            New EMS {checklistPhase === "closing" ? "Closing" : "Readiness"} Checklist
          </h2>
          <p className="mt-1 text-sm font-medium text-white/78">
            Wizard based on Lazem medical readiness standards.
          </p>
        </div>
        <Link
          className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/16"
          href={isManualMode || isB2CMode ? "/missions" : `/projects/${params.projectId}/checklists`}
        >
          Back
        </Link>
      </div>
      </div>

      <div className={`${cardClass} overflow-x-auto`}>
        <div className="flex min-w-[760px] items-center gap-2">
          {wizardSteps.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                  index < step
                    ? "bg-emerald-500 text-white"
                    : index === step
                    ? "bg-[#274C5A] text-white"
                    : "bg-[#f8fbfc] text-[#7F7F7F] ring-1 ring-[#86A7B2]/25"
                }`}
              >
                {index < step ? "OK" : index + 1}
              </div>
              <span className={`text-xs font-bold ${index === step ? "text-[#274C5A]" : "text-[#7F7F7F]"}`}>
                {label}
              </span>
              {index < wizardSteps.length - 1 && <div className="h-px flex-1 bg-[#86A7B2]/25" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div ref={errorRef} className="rounded-xl border border-red-500/40 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {validationIssues.length > 0 && (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-50 p-4 shadow-sm shadow-amber-950/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-amber-900">Checklist items need attention</h3>
              <p className="mt-1 text-sm font-medium text-amber-800">
                Fix the listed items. After one is solved, the wizard will move you to the next issue.
              </p>
            </div>
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-800">
              {validationIssues.length} item{validationIssues.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {validationIssues.map((issue) => (
              <div
                key={`${issue.itemId}-${issue.message}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-white p-3"
              >
                <div>
                  <div className="font-bold text-[#274C5A]">{issue.label}</div>
                  <div className="text-sm text-amber-800">{issue.message}</div>
                </div>
                <button type="button" className={secondaryButtonClass} onClick={() => focusValidationIssue(issue)}>
                  Go to item
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {extraStockPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#274C5A]/55 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#86A7B2]/35 bg-white p-5 shadow-2xl shadow-[#274C5A]/20">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-[#274C5A]">Extra stock entered</h3>
                <p className="mt-1 text-sm text-[#7F7F7F]">
                  These quantities are above the checklist minimum. Confirm to continue, or review the inputs.
                </p>
              </div>
              <span className="rounded-full border border-[#274C5A]/20 bg-[#274C5A]/10 px-3 py-1 text-xs font-black text-[#274C5A]">
                {extraStockPrompt.items.length} item{extraStockPrompt.items.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {extraStockPrompt.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#86A7B2]/25 bg-[#f8fbfc] p-3"
                >
                  <div>
                    <div className="font-bold text-[#274C5A]">{item.label}</div>
                    <div className="text-sm text-[#7F7F7F]">
                      Entered {item.actualQty || 0} / Minimum {item.minQty}
                      {item.unit ? ` ${item.unit}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={secondaryButtonClass}
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
              <button type="button" className={secondaryButtonClass} onClick={reviewExtraStockInputs}>
                Need to review inputs
              </button>
              <button type="button" className={primaryButtonClass} onClick={continueAfterExtraStockConfirm}>
                Confirm and continue
              </button>
            </div>
          </div>
        </div>
      )}

      {shouldRequireProjectUnitSelection && (
        <section className={`${cardClass} space-y-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-[#274C5A]">Select Unit Readiness</h3>
              <p className={mutedTextClass}>
                Choose the unit first. Completed units can only be opened for review.
              </p>
            </div>
            <div className="rounded-full border border-[#86A7B2]/35 bg-[#f8fbfc] px-3 py-1 text-xs font-black text-[#274C5A]">
              {readinessUnitCards.length} unit{readinessUnitCards.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {readinessUnitCards.map((card) => {
              const startOpeningHref = `/projects/${params.projectId}/checklists/new?unitId=${encodeURIComponent(
                card.unitId
              )}&shift=${encodeURIComponent(shiftKey)}`;
              const startClosingHref = `/projects/${params.projectId}/checklists/new?unitId=${encodeURIComponent(
                card.unitId
              )}&shift=${encodeURIComponent(shiftKey)}&phase=closing&sourceChecklistId=${encodeURIComponent(
                card.opening?.id || ""
              )}`;
              const reviewHref = `/projects/${params.projectId}/checklists/${
                card.closing?.id || card.opening?.id || ""
              }`;

              return (
                <article
                  key={card.unitId}
                  className={`rounded-2xl border p-5 ${
                    card.closingDone
                      ? "border-emerald-300 bg-emerald-50"
                      : card.openingDone
                      ? "border-amber-300 bg-amber-50"
                      : "border-[#86A7B2]/25 bg-white"
                  }`}
                >
                  <div className="flex min-h-[190px] flex-col justify-between gap-5">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="badge">
                          {card.closingDone ? "Completed" : card.openingDone ? "Opening done" : "Not started"}
                        </span>
                        <span className="text-xs font-black uppercase tracking-wide text-[#7F7F7F]">
                          {shiftKey}
                        </span>
                      </div>
                      <h4 className="mt-4 text-xl font-black text-[#274C5A]">{card.unitLabel}</h4>
                      <p className="mt-2 text-sm font-semibold text-[#7F7F7F]">
                        Date {dateKey} / {resolvedShift.shiftStartTime} - {resolvedShift.shiftEndTime}
                      </p>
                    </div>

                    {card.closingDone ? (
                      <Link className={secondaryButtonClass} href={reviewHref}>
                        Review Completed
                      </Link>
                    ) : card.opening && !card.openingDone ? (
                      <Link
                        className={primaryButtonClass}
                        href={`/projects/${card.opening.projectId || params.projectId}/checklists/${card.opening.id}`}
                      >
                        Continue Opening
                      </Link>
                    ) : card.openingDone ? (
                      <Link className={primaryButtonClass} href={startClosingHref}>
                        Start Closing
                      </Link>
                    ) : (
                      <Link className={primaryButtonClass} href={startOpeningHref}>
                        Start Opening
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {readinessUnitCards.length === 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-800">
              No units were found for this project. Check the project ambulance assignment or active CAD missions.
            </div>
          )}
        </section>
      )}

      {!shouldRequireProjectUnitSelection && step === 0 && (
        <section className={`${cardClass} space-y-5`}>
          <div>
            <h3 className="text-lg font-black text-[#274C5A]">Info</h3>
            <p className={mutedTextClass}>
              Inspector details come from the logged-in HCAD account.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {isManualMode && (
              <>
                <label className="space-y-2 lg:col-span-2">
                  <span className={labelClass}>Project</span>
                  <select
                    className="select"
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      setUnitSelectionTouched(false);
                      setSelectedUnitId("");
                      setManualUnitId("");
                      setManualUnitCode("");
                    }}
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
                    <span className={labelClass}>Manual Project Name</span>
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
            <div className={metricCardClass}>
              <div className="text-sm text-[#7F7F7F]">Inspector</div>
              <div className="mt-1 font-bold text-[#274C5A]">{inspectorName(user) || "-"}</div>
            </div>
            <div className={metricCardClass}>
              <div className="text-sm text-[#7F7F7F]">Employee ID</div>
              <div className="mt-1 font-bold text-[#274C5A]">
                {user?.employeeId || user?.employeeID || user?.badgeNo || "Not available"}
              </div>
            </div>
            <div className={metricCardClass}>
              <div className="text-sm text-[#7F7F7F]">Riyadh Date</div>
              <div className="mt-1 font-bold text-[#274C5A]">{dateKey}</div>
            </div>
            {isManualMode && selectedProjectId ? (
              shouldAllowProjectUnitPicker ? (
                <label className="space-y-2 lg:col-span-2">
                  <span className={labelClass}>Assigned Unit / Ambulance</span>
                  <select
                    className="select"
                    value={selectedUnitId}
                    onChange={(e) => {
                      const unitId = e.target.value;
                      const unit = unitOptions.find((option) => getUnitIdFromRecord(option) === unitId);
                      const unitCode = unit ? getUnitCodeFromRecord(unit) : unitId;
                      setUnitSelectionTouched(true);
                      setSelectedUnitId(unitId);
                      setManualUnitId(unitId);
                      setManualUnitCode(unitCode);
                    }}
                  >
                    <option value="">Select project unit</option>
                    {unitOptions.map((unit) => {
                      const unitId = getUnitIdFromRecord(unit);
                      return (
                        <option key={unitId} value={unitId}>
                          {getUnitOptionLabel(unit)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : (
                <div
                  className={`${metricCardClass} lg:col-span-2 ${
                    manualUnitId ? "" : "border-amber-400/50 bg-amber-50"
                  }`}
                >
                  <div className="text-sm text-[#7F7F7F]">Assigned Unit / Ambulance</div>
                  <div className="mt-1 font-bold text-[#274C5A]">
                    {manualUnitCode || manualUnitId || "Not detected for this project"}
                  </div>
                </div>
              )
            ) : isManualMode ? (
              <label className="space-y-2 lg:col-span-2">
                <span className={labelClass}>Assigned Unit / Ambulance</span>
                <input
                  className="input"
                  value={manualUnitId}
                    onChange={(e) => setManualUnitId(e.target.value)}
                    placeholder="Ambulance / clinic / team"
                  />
                </label>
            ) : shouldAllowProjectUnitPicker ? (
              <label className="space-y-2 lg:col-span-2">
                <span className={labelClass}>Assigned Unit / Ambulance</span>
                <select
                  className="select"
                  value={selectedUnitId}
                  onChange={(e) => {
                    setUnitSelectionTouched(true);
                    setSelectedUnitId(e.target.value);
                  }}
                >
                  <option value="">Select project unit</option>
                  {unitOptions.map((unit) => {
                    const unitId = getUnitIdFromRecord(unit);
                    return (
                      <option key={unitId} value={unitId}>
                        {getUnitOptionLabel(unit)}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : (
              <div
                className={`${metricCardClass} lg:col-span-2 ${
                  selectedUnitId ? "" : "border-amber-400/50 bg-amber-50"
                }`}
              >
                <div className="text-sm text-[#7F7F7F]">Assigned Unit / Ambulance</div>
                <div className="mt-1 font-bold text-[#274C5A]">{assignedUnitDisplay}</div>
              </div>
            )}
            {isManualMode && selectedProjectId ? (
              <div className={metricCardClass}>
                <div className="text-sm text-[#7F7F7F]">Unit Display Code</div>
                <div className="mt-1 font-bold text-[#274C5A]">
                  {manualUnitCode || manualUnitId || "Not available"}
                </div>
              </div>
            ) : isManualMode && (
              <label className="space-y-2">
                <span className={labelClass}>Unit Display Code</span>
                <input
                  className="input"
                  value={manualUnitCode}
                  onChange={(e) => setManualUnitCode(e.target.value)}
                  placeholder="Shown in dashboard"
                />
              </label>
            )}
            <div className={metricCardClass}>
              <div className="text-sm text-[#7F7F7F]">Shift</div>
              <div className="mt-1 font-bold text-[#274C5A]">{shiftKey}</div>
              <div className="mt-1 text-xs font-semibold text-[#7F7F7F]">
                {resolvedShift.shiftStartTime} - {resolvedShift.shiftEndTime}
              </div>
            </div>
            {usesAutomaticReadinessSettings && (
              <>
                <div className={metricCardClass}>
                  <div className="text-sm text-[#7F7F7F]">Service Level</div>
                  <div className="mt-1 font-bold text-[#274C5A]">{serviceType}</div>
                </div>
                <div className={metricCardClass}>
                  <div className="text-sm text-[#7F7F7F]">Deployment Type</div>
                  <div className="mt-1 font-bold text-[#274C5A]">{deploymentType}</div>
                </div>
              </>
            )}
            {selectedUnitClosedChecklist && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 lg:col-span-3">
                <div className="font-black text-emerald-800">
                  This unit has already completed today&apos;s readiness checklist.
                </div>
                <div className="mt-1 text-sm font-semibold text-emerald-700">
                  Opening and closing are already recorded for {selectedUnitCode || selectedUnitId}. Select another unit to continue.
                </div>
                <Link
                  className="mt-3 inline-flex rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                  href={`/projects/${selectedUnitClosedChecklist.projectId || params.projectId}/checklists/${selectedUnitClosedChecklist.id}`}
                >
                  Open existing checklist
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {currentStepLabel === "Service" && (
        <section className={`${cardClass} space-y-5`}>
          <div>
            <h3 className="text-lg font-black text-[#274C5A]">Service</h3>
            <p className={mutedTextClass}>The selected service level controls the official checklist items for this category.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {SERVICE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setServiceType(type)}
                className={`rounded-xl border p-6 text-left transition ${
                  serviceType === type ? "border-[#274C5A] bg-[#274C5A]/10 shadow-sm shadow-[#274C5A]/10" : "border-[#86A7B2]/25 bg-[#f8fbfc] hover:border-[#274C5A]/45"
                }`}
              >
                <div className="text-2xl font-black text-[#274C5A]">{type}</div>
                <div className="mt-2 text-sm text-[#7F7F7F]">
                  {getServiceDescription(type)}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {currentStepLabel === "Deploy" && (
        <section className={`${cardClass} space-y-5`}>
          <div>
            <h3 className="text-lg font-black text-[#274C5A]">Deploy</h3>
            <p className={mutedTextClass}>The category controls the wizard path and which official standards are loaded.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {DEPLOYMENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDeploymentType(type)}
                className={`rounded-xl border p-6 text-left transition ${
                  deploymentType === type ? "border-[#274C5A] bg-[#274C5A]/10 shadow-sm shadow-[#274C5A]/10" : "border-[#86A7B2]/25 bg-[#f8fbfc] hover:border-[#274C5A]/45"
                }`}
              >
                <div className="text-xl font-black text-[#274C5A]">{type}</div>
                <div className="mt-2 text-sm text-[#7F7F7F]">
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
          <div className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <h3 className="text-lg font-black text-[#274C5A]">{currentStepLabel}</h3>
              <p className={mutedTextClass}>
                Critical and manual items must be answered individually. Check All Eligible skips them.
              </p>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={checkStepEligible}>
              Check All Eligible
            </button>
          </div>

          {Object.entries(grouped).map(([section, groups]) => (
            <div key={section} className={`${cardClass} space-y-4`}>
              <h4 className="text-base font-black text-[#274C5A]">{section}</h4>
              {Object.entries(groups).map(([group, groupItems]) => (
                <div key={group} className="space-y-2">
                  <h5 className="text-sm font-bold uppercase tracking-wide text-[#7F7F7F]">{group}</h5>
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
          <div className={`${cardClass} grid grid-cols-1 gap-4 md:grid-cols-4`}>
            <div>
              <div className="text-sm text-[#7F7F7F]">Result</div>
              <div className="mt-1 text-2xl font-black text-[#274C5A]">{readiness.result}</div>
            </div>
            <div>
              <div className="text-sm text-[#7F7F7F]">Readiness Score</div>
              <div className="mt-1 text-2xl font-black text-[#274C5A]">{readiness.readinessScore}%</div>
            </div>
            <div>
              <div className="text-sm text-[#7F7F7F]">No / Some</div>
              <div className="mt-1 text-2xl font-black text-[#274C5A]">
                {readiness.missingItems.length} / {readiness.someItems.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-[#7F7F7F]">Vehicle Red / Shortages</div>
              <div className="mt-1 text-2xl font-black text-[#274C5A]">
                {readiness.vehicleRedIssues.length} / {readiness.shortageIssues.length}
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="font-black text-[#274C5A]">Issue Summary</h3>
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
                  <div key={item.id} className={metricCardClass}>
                    <div className="font-bold text-[#274C5A]">{item.label}</div>
                    <div className="mt-1 text-sm text-[#7F7F7F]">
                      {statusLabel(item.status)}
                      {item.minQty ? ` / ${item.actualQty || 0} of ${item.minQty}${item.unit ? ` ${item.unit}` : ""}` : ""}
                      {item.identifierValue ? ` / ${item.identifierValue}` : ""}
                    </div>
                  </div>
                ))}
              {readiness.readinessScore === 100 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-3 text-emerald-700">
                  No readiness issues found.
                </div>
              )}
            </div>
          </div>

          {extraStockItems.length > 0 && (
            <div className={`${cardClass} border-[#274C5A]/30 bg-[#274C5A]/5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-[#274C5A]">Extra Stock</h3>
                  <p className="mt-1 text-sm text-[#7F7F7F]">
                    These quantities are above the checklist minimum and will be submitted as recorded.
                  </p>
                </div>
                <span className="rounded-full border border-[#274C5A]/20 bg-[#274C5A]/10 px-3 py-1 text-xs font-black text-[#274C5A]">
                  {extraStockItems.length} item{extraStockItems.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {extraStockItems.map((item) => (
                  <div key={item.id} className={metricCardClass}>
                    <div className="font-bold text-[#274C5A]">{item.label}</div>
                    <div className="mt-1 text-sm text-[#7F7F7F]">
                      Entered {item.actualQty || 0} / Minimum {item.minQty}
                      {item.unit ? ` ${item.unit}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className={`${cardClass} block space-y-2`}>
            <span className={labelClass}>Checklist Notes</span>
            <textarea className="input min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <label className={`${cardClass} flex items-start gap-3 border-[#274C5A]/30 bg-[#274C5A]/5`}>
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-[#274C5A]"
              checked={submitAcknowledged}
              onChange={(e) => setSubmitAcknowledged(e.target.checked)}
            />
            <span className="text-sm font-semibold leading-6 text-[#274C5A]">
              {READINESS_ACKNOWLEDGEMENT_TEXT}
              <span className="mt-2 block text-xs font-bold text-[#7F7F7F]">
                Please review all checklist requirements carefully before submission. By submitting, you confirm that you have read and agree to the applicable{" "}
                <Link
                  href={READINESS_POLICIES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#274C5A] underline underline-offset-4"
                >
                  terms, policies, and operational requirements
                </Link>
                .
              </span>
            </span>
          </label>
        </section>
      )}

      {!shouldRequireProjectUnitSelection && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className={secondaryButtonClass}
          disabled={saving || (step === 0 && !canReturnToUnitSelection)}
          onClick={() => {
            setError("");
            if (step === 0 && canReturnToUnitSelection) {
              router.push(`/projects/${params.projectId}/checklists/new`);
              return;
            }
            setStep((current) => Math.max(0, current - 1));
          }}
        >
          Back
        </button>

        <div className="flex flex-wrap gap-2">
          <button className={secondaryButtonClass} disabled={saving || !canSaveChecklist} onClick={() => save("draft")}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          {currentStepLabel !== "Submit" ? (
            <button
              className={primaryButtonClass}
              disabled={saving || !canSaveChecklist}
              onClick={() => {
                if (validateStep()) setStep((current) => current + 1);
              }}
            >
              Continue
            </button>
          ) : (
            <button className={primaryButtonClass} disabled={saving || !canSaveChecklist || !submitAcknowledged} onClick={() => save("submitted")}>
              {saving ? "Submitting..." : "Submit"}
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
