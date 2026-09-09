type ReportingRecord = {
  historicalImport?: boolean;
  sourceType?: string;
  createdAt?: unknown;
  finalizedAt?: unknown;
  updatedAt?: unknown;
};

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    if (typeof value === "object" && value !== null && "toDate" in value) {
      return asDate((value as { toDate: () => unknown }).toDate());
    }
    const date = value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function getEpcrReportingDate(record: ReportingRecord): Date | null {
  // Historical import stores the original report date in createdAt.
  // Approval and repair timestamps must never move it into another month.
  if (record.historicalImport === true || record.sourceType === "JOTFORM_IMPORT") {
    return asDate(record.createdAt);
  }
  return asDate(record.finalizedAt) || asDate(record.createdAt);
}
