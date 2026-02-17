import type { TransportStatus } from "./types";

export const STATUS_LABEL: Record<TransportStatus, string> = {
  new: "New",
  ops_available: "Ops: Available",
  rejected: "Rejected",
  client_approved: "Client Approved",
  assigned: "Assigned",
};

export type TransportRole = "admin" | "sales" | "ops" | "dispatcher" | "unknown";

export const isAdminRole = (role: TransportRole) => role === "admin";
export const isSalesRole = (role: TransportRole) => role === "sales";
export const isOpsRole = (role: TransportRole) =>
  role === "ops" || role === "dispatcher";

/** Buttons rules (Phase 1) */
export function showMarkAvailable(role: TransportRole, status: TransportStatus) {
  return (isAdminRole(role) || isOpsRole(role)) && status === "new";
}

export function showReject(role: TransportRole, status: TransportStatus) {
  return (
    (isAdminRole(role) || isOpsRole(role)) &&
    (status === "new" || status === "ops_available")
  );
}

export function showClientApproved(role: TransportRole, status: TransportStatus) {
  return (isAdminRole(role) || isSalesRole(role)) && status === "ops_available";
}

export function showAssignTeam(role: TransportRole, status: TransportStatus) {
  return (isAdminRole(role) || isOpsRole(role)) && status === "client_approved";
}
