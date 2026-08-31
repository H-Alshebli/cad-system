export type EntitlementImportRow = Record<string, string | number | null | undefined>;

export function entitlementNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export function entitlementText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeEntitlementRow(row: EntitlementImportRow) {
  const employeeId = entitlementText(row["Employee ID"]);
  const employeeName = entitlementText(row["Employee Name"]);
  const ot2025 = entitlementNumber(row["OT 2025"]);
  const ot2026 = entitlementNumber(row["OT 2026"]);
  const otEntitlement = entitlementNumber(row["OT Entitlement"] || ot2025 + ot2026);
  const otSourcePaid = entitlementNumber(row["OT Source Paid"]);
  const otSourceRemaining = entitlementNumber(row["OT Source Remaining"]);
  const otPaymentMarker = entitlementText(row["OT Payment Marker"]);
  const otEmployment = entitlementText(row["OT Employment"] || "Active");
  const otOperationalPaid = otEmployment === "Left Company" ? otEntitlement : otSourcePaid;
  const otOperationalRemaining = Math.max(0, otEntitlement - otOperationalPaid);

  const perDiem2025 = entitlementNumber(row["Per Diem 2025"]);
  const perDiem2026 = entitlementNumber(row["Per Diem 2026"]);
  const perDiemEntitlement = entitlementNumber(
    row["Per Diem Entitlement"] || perDiem2025 + perDiem2026
  );
  const perDiemSourceRemaining = entitlementNumber(row["Per Diem Source Remaining"]);
  const perDiemPaymentMarker = entitlementText(row["Per Diem Payment Marker"]);
  const perDiemEmployment = entitlementText(row["Per Diem Employment"] || "Active");
  const perDiemOperationalPaid =
    perDiemEmployment === "Left Company" || perDiemPaymentMarker === "Paid"
      ? perDiemEntitlement
      : 0;
  const perDiemOperationalRemaining = Math.max(
    0,
    perDiemEntitlement - perDiemOperationalPaid
  );
  const employmentStatus =
    otEmployment !== "Not in source" ? otEmployment : perDiemEmployment;

  const issues: string[] = [];
  if (!employeeId) issues.push("Missing Employee ID");
  if (otPaymentMarker && otPaymentMarker !== "Paid") issues.push("Invalid OT payment marker");
  if (!["Active", "Left Company", "Not in source"].includes(otEmployment)) {
    issues.push("Invalid OT employment status");
  }
  if (perDiemPaymentMarker && perDiemPaymentMarker !== "Paid") {
    issues.push("Invalid Per Diem payment marker");
  }
  if (!["Active", "Left Company", "Not in source"].includes(perDiemEmployment)) {
    issues.push("Invalid Per Diem employment status");
  }
  if (
    otEmployment !== "Not in source" &&
    perDiemEmployment !== "Not in source" &&
    otEmployment !== perDiemEmployment
  ) {
    issues.push("Employment status differs between Overtime and Per Diem");
  }
  if (Math.abs(otEntitlement - otSourcePaid - otSourceRemaining) > 0.05) {
    issues.push("OT source amounts do not reconcile");
  }
  if (perDiemEntitlement && Math.abs(perDiemEntitlement - perDiemSourceRemaining) > 0.05) {
    issues.push("Per Diem source amounts do not reconcile");
  }

  return {
    employeeId,
    employeeName,
    period: "2025-2026",
    overtime: {
      total2025: ot2025,
      total2026: ot2026,
      entitlement: otEntitlement,
      sourcePaid: otSourcePaid,
      sourceRemaining: otSourceRemaining,
      operationalPaid: otOperationalPaid,
      operationalRemaining: otOperationalRemaining,
      paymentMarker: otPaymentMarker,
      employmentStatus: otEmployment,
    },
    perDiem: {
      total2025: perDiem2025,
      total2026: perDiem2026,
      entitlement: perDiemEntitlement,
      sourceRemaining: perDiemSourceRemaining,
      operationalPaid: perDiemOperationalPaid,
      operationalRemaining: perDiemOperationalRemaining,
      paymentMarker: perDiemPaymentMarker,
      employmentStatus: perDiemEmployment,
    },
    combined: {
      entitlement: otEntitlement + perDiemEntitlement,
      paid: otOperationalPaid + perDiemOperationalPaid,
      remaining: otOperationalRemaining + perDiemOperationalRemaining,
    },
    employmentStatus,
    paymentDate: entitlementText(row["Payment Date"]),
    hrNotes: entitlementText(row["HR Notes"]),
    issues,
  };
}
