import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { FieldPath } from "firebase-admin/firestore";
import { timelineStats } from "@/lib/timelineStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateMs(value: any): number | null {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && Number.isFinite(date.getTime()) ? date.getTime() : null;
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let uid: string;
  try { uid = (await adminAuth.verifyIdToken(token)).uid; }
  catch { return NextResponse.json({ error: "Sign in required." }, { status: 401 }); }
  try {
    const user = (await adminDb.collection("users").doc(uid).get()).data();
    if (!user || user.active === false || ["suspended", "inactive", "pending"].includes(user.accountStatus)) {
      return NextResponse.json({ error: "Account access denied." }, { status: 403 });
    }
    const role = String(user.role || "");
    const admin = ["admin", "super_admin", "superadmin"].includes(role.toLowerCase());
    if (!admin) {
      const permissions = (await adminDb.collection("roles").doc(role).get()).data()?.permissions;
      if (permissions?.dashboards?.timeline !== true || user.accountType === "client" || role.toLowerCase() === "client") {
        return NextResponse.json({ error: "Timeline dashboard access required." }, { status: 403 });
      }
    }
    // Project only the fields used for counting. In particular, never read
    // clinical histories, signatures or the complete ePCR documents here.
    const [caseSnapshot, epcrSnapshot, ambulanceCount] = await Promise.all([
      adminDb.collection("cases").select("status", "dispatchStatus", "isArchived", "projectArchived", "projectName", "projectInfo.projectName", "timeline.Received", "createdAt", "created_at", "date", "caseDate", "transportingToType").get(),
      adminDb.collection("epcr").select("caseId", "projectInfo.projectName", "projectName", "isArchived", "projectArchived").get(),
      adminDb.collection("ambulances").count().get(),
    ]);
    const epcrs = new Map<string, any>();
    for (const item of epcrSnapshot.docs) {
      const data = item.data();
      if (data.isArchived !== true && data.projectArchived !== true) epcrs.set(data.caseId || item.id, data);
    }
    const records = caseSnapshot.docs.map(item => {
      const data = item.data();
      const epcr = epcrs.get(item.id);
      return { ...data, id: item.id, project: epcr?.projectInfo?.projectName || epcr?.projectName || data.projectName || data.projectInfo?.projectName || "—", dateMs: dateMs(data.timeline?.Received || data.createdAt || data.created_at || data.date || data.caseDate) };
    }).filter((item: any) => item.isArchived !== true && item.projectArchived !== true) as any[];
    const params = request.nextUrl.searchParams;
    const project = params.get("project") || "";
    const start = params.get("start");
    const end = params.get("end");
    for (const value of [start, end]) if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    const from = start ? Date.parse(`${start}T00:00:00+03:00`) : null;
    const to = end ? Date.parse(`${end}T23:59:59.999+03:00`) : null;
    const filtered = records.filter(item => (!project || item.project === project) && (from === null || (item.dateMs !== null && item.dateMs >= from)) && (to === null || (item.dateMs !== null && item.dateMs <= to)));
    const stats = timelineStats(filtered, ambulanceCount.data().count);
    const active = (item: any) => !["closed", "completed", "cancelled", "canceled"].includes(String(item.status || item.dispatchStatus || "").trim().toLowerCase());
    const offset = Math.max(0, Math.floor(Number(params.get("offset")) || 0));
    const candidates = filtered.filter(item => params.get("all") === "true" || active(item)).sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0) || a.id.localeCompare(b.id));
    const selected = candidates.slice(offset, offset + 50);
    const caseDetails = new Map<string, any>();
    const reportDetails = new Map<string, any>();
    const chunks = [selected.slice(0, 30), selected.slice(30)].filter(chunk => chunk.length);
    await Promise.all(chunks.map(async chunk => {
      const ids = chunk.map(item => item.id);
      const [cases, reports] = await Promise.all([
        adminDb.collection("cases").where(FieldPath.documentId(), "in", ids).select("caseNumber", "caseSequence", "lazemCode", "ijrny", "chiefComplaint", "caseInfo.complaint", "assignedUnit", "timeline").get(),
        adminDb.collection("epcr").where(FieldPath.documentId(), "in", ids).select("epcrNumber").get(),
      ]);
      cases.docs.forEach(item => caseDetails.set(item.id, item.data()));
      reports.docs.forEach(item => reportDetails.set(item.id, item.data()));
    }));
    const cards = selected.map(item => {
      const data = caseDetails.get(item.id) || {};
      const epcr = reportDetails.get(item.id);
      const timeline = Object.fromEntries(Object.entries(data.timeline || {}).map(([key, value]: [string, any]) => [key, value?.toDate ? value.toDate().toISOString() : value]));
      return { id: item.id, caseNumber: data.caseNumber, caseSequence: data.caseSequence, lazemCode: data.lazemCode, ijrny: data.ijrny, projectName: item.project, chiefComplaint: data.chiefComplaint || data.caseInfo?.complaint, assignedUnit: data.assignedUnit || null, createdAt: item.dateMs === null ? null : new Date(item.dateMs).toISOString(), timeline, epcrNumber: epcr?.epcrNumber || "" };
    });
    return NextResponse.json({ stats, cards, projects: [...new Set(records.map(item => item.project).filter(name => name !== "—"))].sort(), hasMore: offset + 50 < candidates.length, totalVisible: candidates.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Timeline dashboard load failed", error);
    return NextResponse.json({ error: "Could not load dashboard. Please retry." }, { status: 500 });
  }
}
