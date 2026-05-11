// lib/permissionsMatrix.ts

export type PermissionsMap = Record<string, Record<string, boolean>>;

export const PERMISSION_MATRIX: Record<string, string[]> = {
  dashboards: ["view", "timeline", "epcr", "executive", "all_data"],

  projects: [
    "view",
    "view_all",
    "create",
    "edit",
    "assign",
    "archive",
    "delete",
  ],

  cases: [
    "view",
    "view_all",
    "view_own",
    "create",
    "edit",
    "assign",
    "update_status",
    "close",
    "delete",
  ],

  cad: [
    "view",
    "dispatch",
    "manage_status",
    "view_timeline",
    "internal_chat",
  ],

  epcr: [
    "view",
    "view_dashboard",
    "create",
    "edit",
    "finalize",
    "export_pdf",
    "view_sensitive",
  ],

  ambulances: ["view", "create", "edit", "assign", "archive", "delete"],

  destinations: ["view", "create", "edit", "delete"],
  clinics: ["view", "create", "edit", "delete"],
  roaming: ["view", "create", "edit", "assign", "delete"],

  transport: [
    "view",
    "create",
    "approve",
    "ops",
    "assign",
    "reject",
    "export",
  ],

  client_portal: ["view"],
  client_cases: ["view", "view_own", "create", "track"],
  client_dashboards: ["timeline", "epcr"],

  reports: ["view", "export"],
  users: ["view", "create", "edit", "activate", "deactivate", "delete"],
  roles: ["view", "create", "edit", "delete"],
  settings: ["view", "edit"],
  location_picker: ["view"],
};

export const MODULE_LABELS: Record<string, string> = {
  dashboards: "Dashboards",
  projects: "Projects",
  cases: "Cases",
  cad: "CAD / Dispatch",
  epcr: "ePCR",
  ambulances: "Ambulances",
  destinations: "Hospitals / Destinations",
  clinics: "Clinics",
  roaming: "Roaming Units",
  transport: "Transport / Coverage",
  client_portal: "Client Portal",
  client_cases: "Client Cases",
  client_dashboards: "Client Dashboards",
  reports: "Reports",
  users: "Users",
  roles: "Roles / Permissions",
  settings: "Settings",
  location_picker: "Location Picker",
};

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  dashboards: "Main operational, timeline, ePCR, executive, and all-data dashboards.",
  projects: "Project list, project creation, editing, assignment, and archiving.",
  cases: "Case records, case creation, case assignment, status updates, and closure.",
  cad: "Internal dispatch workspace, status control, timeline, and internal case chat.",
  epcr: "ePCR access, editing, finalization, PDF export, and sensitive medical details.",
  ambulances: "Ambulance list, creation, editing, project assignment, and archiving.",
  destinations: "Hospitals and destination locations used during Transporting.",
  clinics: "Clinic module access and management.",
  roaming: "Roaming units access and assignment.",
  transport: "Transport and coverage request workflow approvals and operations.",
  client_portal: "External client portal shell and home page.",
  client_cases: "Client case request creation, own-case viewing, and tracking.",
  client_dashboards: "Client-safe timeline and ePCR dashboards.",
  reports: "Operational reports and export capabilities.",
  users: "User management and account activation.",
  roles: "Role and permission management.",
  settings: "System settings.",
  location_picker: "Location picker utility page.",
};

export const ACTION_LABELS: Record<string, string> = {
  view: "View",
  view_all: "View All",
  view_own: "View Own",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  archive: "Archive",
  assign: "Assign",
  update_status: "Update Status",
  close: "Close",
  dispatch: "Dispatch",
  manage_status: "Manage Status",
  view_timeline: "View Timeline",
  internal_chat: "Internal Chat",
  view_dashboard: "View Dashboard",
  finalize: "Finalize",
  export_pdf: "Export PDF",
  view_sensitive: "Sensitive Data",
  approve: "Approve",
  ops: "Operations",
  reject: "Reject",
  export: "Export",
  import: "Import",
  activate: "Activate",
  deactivate: "Deactivate",
  track: "Track",
  timeline: "Timeline",
  epcr: "ePCR",
  executive: "Executive",
  all_data: "All Data",
};

export const PERMISSION_GROUPS = [
  {
    title: "Operations",
    modules: ["dashboards", "projects", "cases", "cad", "epcr"],
  },
  {
    title: "Resources",
    modules: ["ambulances", "destinations", "clinics", "roaming", "transport"],
  },
  {
    title: "Client Access",
    modules: ["client_portal", "client_cases", "client_dashboards"],
  },
  {
    title: "Administration",
    modules: ["reports", "users", "roles", "settings", "location_picker"],
  },
];

export function normalizePermissions(permissions: PermissionsMap = {}) {
  const normalized: PermissionsMap = {};

  Object.entries(PERMISSION_MATRIX).forEach(([moduleKey, actions]) => {
    normalized[moduleKey] = {};
    actions.forEach((action) => {
      normalized[moduleKey][action] = Boolean(
        permissions?.[moduleKey]?.[action]
      );
    });
  });

  return normalized;
}
