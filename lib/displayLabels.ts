function clean(value: any) {
  const text = String(value || "").trim();
  return text && text !== "undefined" && text !== "null" ? text : "";
}

export function shortTechnicalId(value: any, prefix = "REF") {
  const text = clean(value);
  if (!text) return "";
  return `${prefix}-${text.slice(0, 6).toUpperCase()}`;
}

export function getProjectDisplayName(project: any) {
  return (
    clean(project?.projectName) ||
    clean(project?.name) ||
    clean(project?.title) ||
    clean(project?.clientName) ||
    clean(project?.client) ||
    shortTechnicalId(project?.id || project?.projectId, "PROJECT") ||
    "Project"
  );
}

export function getUnitDisplayName(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (
    clean(value?.unitCode) ||
    clean(value?.code) ||
    clean(value?.name) ||
    clean(value?.label) ||
    clean(value?.assignedAmbulanceCode) ||
    clean(value?.assignedAmbulanceId) ||
    shortTechnicalId(value?.id || value?.unitId, "UNIT")
  );
}

export function getCaseDisplayCode(item: any) {
  const source = clean(item?.sourceType || item?.caseType).toLowerCase();
  if (source.includes("b2c")) {
    return (
      clean(item?.bookingConfirmationNumber && `B2C-${item.bookingConfirmationNumber}`) ||
      clean(item?.lazemCode) ||
      clean(item?.caseNumber) ||
      buildCaseDescriptor(item, "B2C")
    );
  }
  return (
    clean(item?.lazemCode) ||
    clean(item?.caseNumber) ||
    buildCaseDescriptor(item, "HCAD")
  );
}

export function getCaseDisplayTitle(item: any) {
  const projectName = clean(item?.projectName || item?.assignedProjectName || item?.project?.projectName);
  const patientName = clean(item?.patientName || item?.patient?.name);
  const complaint = clean(item?.chiefComplaint || item?.complaint || item?.serviceType || item?.diagnosisOrReason);
  const unit = getUnitDisplayName(
    item?.assignedUnit || {
      unitCode:
        item?.assignedAmbulanceCode ||
        item?.unitCode ||
        item?.plannedAssignment?.unitCode ||
        item?.plannedAssignment?.unitId,
    }
  );

  return [projectName, patientName, complaint, unit].filter(Boolean).join(" / ") || getCaseDisplayCode(item);
}

export function getMissionDisplayName(mission: any) {
  const code = getCaseDisplayCode(mission);
  const title = getCaseDisplayTitle(mission);
  return title && title !== code ? `${code} - ${title}` : code;
}

export function getChecklistMissionDisplay(checklist: any) {
  return (
    clean(checklist?.missionLabel) ||
    [clean(checklist?.projectName), clean(checklist?.unitCode || checklist?.unitId), clean(checklist?.dateKey), clean(checklist?.shiftKey)]
      .filter(Boolean)
      .join(" / ") ||
    shortTechnicalId(checklist?.missionId, "MISSION") ||
    "Checklist Mission"
  );
}

export function getB2CRequestDisplay(request: any) {
  return (
    clean(request?.bookingConfirmationNumber && `Booking #${request.bookingConfirmationNumber}`) ||
    [clean(request?.patientName), clean(request?.pickupText), clean(request?.destinationText)].filter(Boolean).join(" -> ") ||
    shortTechnicalId(request?.id, "B2C")
  );
}

function buildCaseDescriptor(item: any, prefix: string) {
  const project = clean(item?.projectName || item?.assignedProjectName);
  const complaint = clean(item?.chiefComplaint || item?.complaint || item?.serviceType);
  const date = clean(item?.dateKey || item?.createdDate || item?.requestedAt || item?.requestedTransportAt).slice(0, 10);
  const unit = getUnitDisplayName(item?.assignedUnit || { unitCode: item?.assignedAmbulanceCode || item?.unitCode });
  const descriptor = [project, complaint, date, unit].filter(Boolean).join("-");
  return descriptor || shortTechnicalId(item?.id, prefix) || `${prefix}-CASE`;
}
