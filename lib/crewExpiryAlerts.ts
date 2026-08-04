import {
  CREW_PROFILE_FIELDS,
  CrewProfileValues,
  getCrewProfileValues,
} from "@/lib/crewProfile";

export const CREW_EXPIRY_THRESHOLDS = [90, 60, 30] as const;

export type CrewExpiryThreshold = (typeof CREW_EXPIRY_THRESHOLDS)[number];

export type CrewExpiryCandidate = {
  fieldKey: string;
  fieldLabel: string;
  expiryDate: string;
  daysRemaining: number;
  dueThresholds: CrewExpiryThreshold[];
};

const expiryFieldKeys = new Set(
  CREW_PROFILE_FIELDS.filter(
    (field) =>
      field.type === "date" &&
      (field.key.toLowerCase().includes("expiry") ||
        field.key === "contractEndDate")
  ).map((field) => field.key)
);

function startOfUtcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function getDaysRemaining(expiryDate: string, today = new Date()) {
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil(
    (startOfUtcDay(expiry) - startOfUtcDay(today)) / (24 * 60 * 60 * 1000)
  );
}

export function getDueExpiryThresholds(daysRemaining: number) {
  if (daysRemaining <= 0) return [];
  if (daysRemaining <= 30) return [30] as CrewExpiryThreshold[];
  if (daysRemaining <= 60) return [60] as CrewExpiryThreshold[];
  if (daysRemaining <= 90) return [90] as CrewExpiryThreshold[];
  return [];
}

export function getCrewExpiryCandidates(
  user: Record<string, any>,
  today = new Date()
): CrewExpiryCandidate[] {
  const values: CrewProfileValues = getCrewProfileValues(user);

  return CREW_PROFILE_FIELDS.filter((field) => expiryFieldKeys.has(field.key))
    .map((field) => {
      const expiryDate = String(values[field.key] || "").trim();
      if (!expiryDate) return null;
      const daysRemaining = getDaysRemaining(expiryDate, today);
      if (daysRemaining === null) return null;
      const dueThresholds = getDueExpiryThresholds(daysRemaining);
      if (!dueThresholds.length) return null;

      return {
        fieldKey: field.key,
        fieldLabel: field.label,
        expiryDate,
        daysRemaining,
        dueThresholds,
      };
    })
    .filter(Boolean) as CrewExpiryCandidate[];
}

export function buildCrewExpiryAlertId(
  userId: string,
  fieldKey: string,
  expiryDate: string,
  threshold: CrewExpiryThreshold
) {
  return `${userId}_${fieldKey}_${expiryDate}_${threshold}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );
}
