export type ReviewNotice = {
  kind: "epcr" | "checklist";
  recordId: string;
  action: "submit" | "comment" | "approve" | "return";
  ownerId: string;
  projectId?: string;
  at: string;
};
export function noticeEnabled(enabled: string | undefined, start: string | undefined, submittedAt: unknown) {
  if (enabled !== "true" || !start || !/(Z|[+-]\d{2}:\d{2})$/.test(start)) return false;
  const boundary = Date.parse(start);
  const submitted = typeof submittedAt === "string" ? Date.parse(submittedAt) : NaN;
  return Number.isFinite(boundary) && Number.isFinite(submitted) && submitted >= boundary;
}
export function noticeLink(event: ReviewNotice) {
  return event.kind === "epcr" ? `/epcr/${encodeURIComponent(event.recordId)}`
    : `/projects/${encodeURIComponent(event.projectId || "unknown")}/checklists/${encodeURIComponent(event.recordId)}`;
}
export function noticeTitle(event: ReviewNotice) {
  const item = event.kind === "epcr" ? "ePCR" : "Checklist";
  return `${item}: ${ { submit: "awaiting review", comment: "new review comment", approve: "approved", return: "returned for correction" }[event.action]}`;
}
// Notification opt-in is explicit even for admin roles. Access is still required.
export function canReceiveNotice(event: ReviewNotice, uid: string, user: any, permissions: any) {
  if (user?.active !== true || user.accountType === "client") return false;
  const admin = ["admin", "super_admin", "superadmin"].includes(String(user.role || "").trim().toLowerCase());
  if (event.action !== "submit") {
    if (uid !== event.ownerId) return false;
    return admin || (event.kind === "epcr" ? permissions?.epcr?.view === true
      : permissions?.readiness_checklists?.view_all === true || permissions?.readiness_checklists?.view_own === true || permissions?.readiness_checklists?.view === true);
  }
  const p = permissions?.[event.kind === "epcr" ? "epcr_medical_review" : "readiness_checklists"];
  if (p?.receive_notifications !== true) return false;
  if (event.kind === "epcr") return admin || (p.view === true && (p.review === true || p.approve === true || p.return_for_correction === true));
  // Match existing checklist visibility: all checklists, or inspector's own.
  return admin || (p.review === true && (p.view_all === true || (uid === event.ownerId && (p.view === true || p.view_own === true))));
}
