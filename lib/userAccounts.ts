export type UserAccountType = "employee" | "client";

const LEGACY_CLIENT_ROLES = new Set(["client", "client_portal", "customer"]);

export function getUserAccountType(user: any): UserAccountType {
  if (user?.accountType === "client") return "client";
  if (user?.accountType === "employee") return "employee";

  const role = String(user?.role || "").trim().toLowerCase();
  return LEGACY_CLIENT_ROLES.has(role) ? "client" : "employee";
}

export function isClientAccount(user: any) {
  return getUserAccountType(user) === "client";
}
