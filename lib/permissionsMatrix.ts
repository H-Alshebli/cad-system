// lib/permissionsMatrix.ts

export const PERMISSION_MATRIX = {
  dashboards: ["view"],
  cases: ["view", "create", "edit", "delete"],

  // ✅ add missing permissions
  projects: ["view", "create", "edit", "assign", "view_all"],
  transport: ["view", "create", "approve", "ops", "assign", "reject"],


  clinics: ["view"],
  ambulances: ["view"],
  roaming: ["view"],
  reports: ["view", "export"],
  users: ["view"],
  epcr: ["view", "edit"],
};
