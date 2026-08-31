import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { normalizeEntitlementRow, type EntitlementImportRow } from "@/lib/employeeEntitlements";
import {
  actorCan,
  authenticateEntitlementsActor,
} from "@/lib/server/employeeEntitlementsAuth";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

async function userIndex() {
  const snapshot = await adminDb.collection("users").get();
  const index = new Map<string, Array<{ id: string; data: Record<string, any> }>>();
  snapshot.docs.forEach((document) => {
    const data = document.data() || {};
    const employeeId = String(data.employeeId || data.crewProfile?.employeeId || "").trim();
    if (!employeeId) return;
    index.set(employeeId, [...(index.get(employeeId) || []), { id: document.id, data }]);
  });
  return index;
}

const monthColumns = ["Jun 2025", "Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026"];

function monthlyIndex(rows: EntitlementImportRow[], kind: string) {
  const index = new Map<string, { entries: Array<{ month: string; quantity: number }>; issues: string[] }>();
  rows.forEach((row) => {
    const employeeId = String(row["Employee ID"] || "").trim();
    if (!employeeId) return;
    const issues: string[] = [];
    if (index.has(employeeId)) issues.push(`Employee ID appears more than once in ${kind}`);
    const entries = monthColumns.flatMap((month) => {
      const raw = row[month];
      if (raw === "" || raw === null || raw === undefined || raw === "-") return [];
      const quantity = Number(String(raw).replace(/,/g, ""));
      if (!Number.isFinite(quantity) || quantity < 0) {
        issues.push(`Invalid ${kind} value for ${month}`);
        return [];
      }
      return quantity > 0 ? [{ month, quantity }] : [];
    });
    index.set(employeeId, { entries, issues });
  });
  return index;
}

async function prepareRows(rows: EntitlementImportRow[], monthlyOtRows: EntitlementImportRow[], monthlyPerDiemRows: EntitlementImportRow[]) {
  const index = await userIndex();
  const overtimeIndex = monthlyIndex(monthlyOtRows, "Monthly OT Hours");
  const perDiemIndex = monthlyIndex(monthlyPerDiemRows, "Monthly Per Diem");
  const seenEmployeeIds = new Set<string>();
  return rows.map((input) => {
    const normalized = normalizeEntitlementRow(input);
    const matches = index.get(normalized.employeeId) || [];
    const issues = [...normalized.issues];
    const monthlyOvertime = overtimeIndex.get(normalized.employeeId)?.entries || [];
    const monthlyPerDiem = perDiemIndex.get(normalized.employeeId)?.entries || [];
    issues.push(...(overtimeIndex.get(normalized.employeeId)?.issues || []));
    issues.push(...(perDiemIndex.get(normalized.employeeId)?.issues || []));
    if (normalized.overtime.entitlement > 0 && !monthlyOvertime.length) issues.push("Monthly OT Hours details are missing");
    if (normalized.perDiem.entitlement > 0 && !monthlyPerDiem.length) issues.push("Monthly Per Diem details are missing");
    if (!matches.length) issues.push("Employee ID was not found in HCAD");
    if (matches.length > 1) issues.push("Employee ID is assigned to multiple HCAD users");
    if (seenEmployeeIds.has(normalized.employeeId)) issues.push("Employee ID appears more than once in the workbook");
    if (normalized.employeeId) seenEmployeeIds.add(normalized.employeeId);
    const match = matches.length === 1 ? matches[0] : null;
    return {
      ...normalized,
      userId: match?.id || "",
      accountName: String(match?.data.name || match?.data.displayName || ""),
      accountEmail: String(match?.data.email || ""),
      monthlyOvertime,
      monthlyPerDiem,
      issues,
    };
  });
}

export async function POST(request: NextRequest) {
  const actor = await authenticateEntitlementsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "preview");
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const monthlyOtRows = Array.isArray(body.monthlyOtRows) ? body.monthlyOtRows : [];
  const monthlyPerDiemRows = Array.isArray(body.monthlyPerDiemRows) ? body.monthlyPerDiemRows : [];
  if (!rows.length || rows.length > 200) {
    return NextResponse.json({ error: "The import must contain between 1 and 200 employees." }, { status: 400 });
  }
  if (!actorCan(actor, action === "preview" ? "view_all" : "import")) {
    return NextResponse.json({ error: "HR entitlement import permission is required." }, { status: 403 });
  }

  const prepared = await prepareRows(rows, monthlyOtRows, monthlyPerDiemRows);
  const invalid = prepared.filter((row) => row.issues.length);
  const finalEmployeeIds = new Set(rows.map((row: EntitlementImportRow) => String(row["Employee ID"] || "").trim()).filter(Boolean));
  const workbookIssues = [
    ...monthlyOtRows.map((row: EntitlementImportRow) => String(row["Employee ID"] || "").trim()).filter((id: string) => id && !finalEmployeeIds.has(id)).map((id: string) => `Employee ID ${id} exists in Monthly OT Hours but not in Final Import`),
    ...monthlyPerDiemRows.map((row: EntitlementImportRow) => String(row["Employee ID"] || "").trim()).filter((id: string) => id && !finalEmployeeIds.has(id)).map((id: string) => `Employee ID ${id} exists in Monthly Per Diem but not in Final Import`),
  ];
  const summary = {
    total: prepared.length,
    matched: prepared.filter((row) => row.userId).length,
    invalid: invalid.length + workbookIssues.length,
    entitlement: prepared.reduce((sum, row) => sum + row.combined.entitlement, 0),
    paid: prepared.reduce((sum, row) => sum + row.combined.paid, 0),
    remaining: prepared.reduce((sum, row) => sum + row.combined.remaining, 0),
  };

  if (action === "preview") {
    return NextResponse.json({ rows: prepared, summary, workbookIssues });
  }
  if (action !== "import") {
    return NextResponse.json({ error: "Invalid import action." }, { status: 400 });
  }
  if (invalid.length || workbookIssues.length) {
    return NextResponse.json(
      { error: "Resolve every preview error before importing.", rows: prepared, summary, workbookIssues },
      { status: 409 }
    );
  }

  const batchRef = adminDb.collection("employeeEntitlementBatches").doc();
  const writer = adminDb.batch();
  writer.create(batchRef, {
    fileName: String(body.fileName || "Employee Entitlements.xlsx"),
    period: "2025-2026",
    status: "draft",
    recordCount: prepared.length,
    totals: {
      entitlement: summary.entitlement,
      paid: summary.paid,
      remaining: summary.remaining,
    },
    createdBy: actor.uid,
    createdByName: actor.name,
    createdByEmail: actor.email,
    createdAt: FieldValue.serverTimestamp(),
    auditHistory: [{ action: "imported_as_draft", actorId: actor.uid, at: new Date().toISOString() }],
  });

  prepared.forEach((row) => {
    const recordRef = adminDb.collection("employeeEntitlements").doc();
    writer.create(recordRef, {
      batchId: batchRef.id,
      version: 1,
      userId: row.userId,
      employeeId: row.employeeId,
      employeeName: row.employeeName || row.accountName,
      employeeEmail: row.accountEmail,
      period: row.period,
      overtime: row.overtime,
      perDiem: row.perDiem,
      monthlyOvertime: row.monthlyOvertime,
      monthlyPerDiem: row.monthlyPerDiem,
      combined: row.combined,
      employmentStatus: row.employmentStatus,
      paymentDate: row.paymentDate || "",
      hrNotes: row.hrNotes || "",
      status: "draft",
      createdBy: actor.uid,
      createdByName: actor.name,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      auditHistory: [{ action: "imported_as_draft", actorId: actor.uid, at: new Date().toISOString() }],
    });
  });
  await writer.commit();

  return NextResponse.json({ batchId: batchRef.id, summary });
}
