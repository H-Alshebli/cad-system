function hhmmToMinutes(time?: string): number | null {
  if (!time) return null;

  const parts = String(time).split(":");
  if (parts.length !== 2) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function toDate(value: any): Date | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function minutesBetween(start: number, end: number) {
  let diff = end - start;

  if (diff < 0) {
    diff += 24 * 60;
  }

  return diff > 0 ? diff : null;
}

function timestampDiffMinutes(start: any, end: any) {
  const startDate = toDate(start);
  const endDate = toDate(end);

  if (!startDate || !endDate) return null;

  const diff = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  return diff > 0 ? diff : null;
}

function pickTimeValue(...values: any[]) {
  for (const value of values) {
    if (value?.timeHHMM) return value.timeHHMM;
    if (typeof value === "string") return value;
  }

  return "";
}

export function getEpcrResponseMinutes(epcr: any): number | null {
  const explicit =
    Number(epcr?.responseTimeMinutes) ||
    Number(epcr?.responseTime?.minutes) ||
    Number(epcr?.responseTime?.avgMinutes) ||
    0;

  if (explicit > 0) {
    return explicit;
  }

  const timeline = epcr?.timeline || epcr?.caseSnapshot?.timeline || {};
  const timestampDiff = timestampDiffMinutes(
    timeline.receivedAt || timeline.Received || epcr?.receivedAt,
    timeline.onSceneAt || timeline.OnScene || epcr?.onSceneAt
  );

  if (timestampDiff) {
    return timestampDiff;
  }

  const startMin = hhmmToMinutes(
    pickTimeValue(
      epcr?.time?.receivedTime,
      epcr?.time?.Received,
      epcr?.time?.movingTime
    )
  );
  const endMin = hhmmToMinutes(
    pickTimeValue(epcr?.time?.arrivalToPTTime, epcr?.time?.arrivalTime)
  );

  if (startMin === null || endMin === null) {
    return null;
  }

  return minutesBetween(startMin, endMin);
}
