export type ClinicUnit = {
  id: string;
  unitId: string;
  unitCode: string;
  name: string;
  unitType: "Clinic";
  assignedUserIds: string[];
};

function uniqueIds(value: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    )
  );
}

export function normalizeClinicUnits(value: unknown): ClinicUnit[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry: any, index) => {
    const unitId = String(entry?.unitId || entry?.id || "").trim();
    if (!unitId || seen.has(unitId)) return [];
    seen.add(unitId);
    const name = String(entry?.name || entry?.unitCode || `Clinic ${index + 1}`).trim();
    return [{
      id: unitId,
      unitId,
      unitCode: String(entry?.unitCode || name).trim(),
      name,
      unitType: "Clinic" as const,
      assignedUserIds: uniqueIds(entry?.assignedUserIds || entry?.crewUserIds),
    }];
  });
}

export function createClinicUnit(index: number): ClinicUnit {
  const id = `clinic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = `Clinic ${index}`;
  return { id, unitId: id, unitCode: name, name, unitType: "Clinic", assignedUserIds: [] };
}

export function projectClinicUnits(project: any) {
  return normalizeClinicUnits(project?.clinicUnits);
}
