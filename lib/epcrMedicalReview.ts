// Pure workflow policy; no database access and no automatic legacy migration.
export type ReviewState = "pending" | "approved" | "returned" | "historical_approved";
export type ReviewAction = "comment" | "approve" | "return";
export type MedicalReview = {
  status: ReviewState;
  revision: number;
  submission: number;
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
};
export function medicalReviewLabel(record?: { medicalReview?: MedicalReview } | null): string {
  switch (record?.medicalReview?.status) {
    case "pending": return "Pending Medical Review";
    case "approved": return "Medically Approved";
    case "returned": return "Returned for Correction";
    case "historical_approved": return "Historical Approval";
    default: return "Not reviewed";
  }
}
export function reviewTransition(current: MedicalReview, action: ReviewAction, actorId: string, notes: string, now: string, isAdmin = false): MedicalReview {
  if (current.status !== "pending") throw new Error("Only pending submissions can be reviewed.");
  if (action !== "comment" && current.submittedBy === actorId && !isAdmin) throw new Error("You cannot approve or return your own submission.");
  if ((action === "comment" || action === "return") && !notes.trim()) throw new Error("A comment is required.");
  if (notes.length > 4000) throw new Error("Comment exceeds 4,000 characters.");
  return { ...current, revision: current.revision + 1,
    ...(action === "comment" ? {} : { status: action === "approve" ? "approved" as const : "returned" as const, reviewedBy: actorId, reviewedAt: now }),
    notes: notes.trim(),
  };
}
// Candidate classification ONLY. A verified source and completeness evidence
// must be supplied by the audit; createdAt/import time is never a fallback.
export function historicalReviewCandidate(input: { verifiedCaseDate?: string; sourceVerified: boolean; complete: boolean; submitted: boolean }): "eligible_historical" | "requires_review" | "needs_date_verification" | "incomplete" {
  if (!input.complete || !input.submitted) return "incomplete";
  if (!input.sourceVerified || !input.verifiedCaseDate || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.verifiedCaseDate)) return "needs_date_verification";
  const date = Date.parse(input.verifiedCaseDate);
  if (!Number.isFinite(date)) return "needs_date_verification";
  const day = input.verifiedCaseDate.slice(0, 10);
  const calendar = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day) return "needs_date_verification";
  return date < Date.parse("2026-09-01T00:00:00+03:00") ? "eligible_historical" : "requires_review";
}
