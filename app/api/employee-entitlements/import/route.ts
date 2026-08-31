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

async function prepareRows(rows: EntitlementImportRow[]) {
  const index = await userIndex();
  const seenEmployeeIds = new Set<string>();
  return rows.map((input) => {
    const normalized = normalizeEntitlementRow(input);
    const matches = index.get(normalized.employeeId) || [];
    const issues = [...normalized.issues];
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
  if (!rows.length || rows.length > 200) {
    return NextResponse.json({ error: "The import must contain between 1 and 200 employees." }, { status: 400 });
  }
  if (!actorCan(actor, action === "preview" ? "view_all" : "import")) {
    return NextResponse.json({ error: "HR entitlement import permission is required." }, { status: 403 });
  }

  const prepared = await prepareRows(rows);
  const invalid = prepared.filter((row) => row.issues.length);
  const summary = {
    total: prepared.length,
    matched: prepared.filter((row) => row.userId).length,
    invalid: invalid.length,
    entitlement: prepared.reduce((sum, row) => sum + row.combined.entitlement, 0),
    paid: prepared.reduce((sum, row) => sum + row.combined.paid, 0),
    remaining: prepared.reduce((sum, row) => sum + row.combined.remaining, 0),
  };

  if (action === "preview") {
    return NextResponse.json({ rows: prepared, summary });
  }
  if (action !== "import") {
    return NextResponse.json({ error: "Invalid import action." }, { status: 400 });
  }
  if (invalid.length) {
    return NextResponse.json(
      { error: "Resolve every preview error before importing.", rows: prepared, summary },
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
