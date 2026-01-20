// lib/permissionsMatrix.ts

export const PERMISSION_MATRIX = {
  dashboards: ["view"],
  cases: ["view", "create", "edit", "delete"],
  projects: ["view", "create"],
  clinics: ["view"],
  ambulances: ["view"],
  roaming: ["view"],
  reports: ["view", "export"],
  users: ["view"],
  epcr: ["view", "edit"],
};
