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

  call_intake: ["view", "create", "project_case", "b2c_case"],

  // Old compatibility module.
  // Keep it for now so old roles do not break.
  b2c_cases: ["view", "create", "confirm_payment", "assign", "cancel"],

  // New B2C Request workflow module.
  // This is the correct module for the new request-before-CAD flow.
  b2c_requests: [
    "view",
    "view_all",
    "view_assigned",
    "create",
    "edit",
    "update",
    "confirm_payment",
    "change_team",
    "activate_cad",
    "cancel",
  ],

  missions: [
    "view",
    "view_assigned",
    "acknowledge",
    "update_status",
    "report",
  ],

  crew_profile: ["view", "edit_own", "view_all", "edit_all"],

  readiness_checklists: [
    "view",
    "view_all",
    "view_own",
    "create",
    "edit_own_draft",
    "submit",
    "review",
    "approve",
    "return_for_correction",
    "manage_expiry",
    "export_pdf",
    "manage_templates",
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

  submissions: ["view", "export"],

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
  cases: "CAD Cases",
  cad: "CAD / Dispatch",
  call_intake: "Call Intake",

  b2c_cases: "B2C Cases",
  b2c_requests: "B2C Requests",

  missions: "My Missions",
  crew_profile: "Crew Profile",
  readiness_checklists: "Readiness Checklists",
  epcr: "ePCR",
  submissions: "Submissions",
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
  dashboards:
    "Main operational, timeline, ePCR, executive, and all-data dashboards.",

  projects:
    "Project list, project creation, editing, assignment, and archiving.",

  cases:
    "Active CAD case records, case assignment, status updates, and closure.",

  cad:
    "Internal dispatch workspace, status control, timeline, and internal case chat.",

  call_intake:
    "Dispatcher intake screen for project calls and B2C customer calls.",

  b2c_cases:
    "Old B2C case permissions kept for compatibility with earlier system logic.",

  b2c_requests:
    "B2C request workflow before CAD activation, including payment confirmation, request editing, planned ambulance/team changes, and CAD creation.",

  missions:
    "Assigned missions for paramedics and field teams, including acknowledgement and status updates.",

  crew_profile:
    "Crew member personal, employment, license, contact, and bank profile data.",

  readiness_checklists:
    "Project EMS readiness checks linked to missions, units, shifts, inspectors, and supervisor review.",

  epcr:
    "ePCR access, editing, finalization, PDF export, and sensitive medical details.",

  submissions:
    "Case and ePCR submission review, consolidated visibility, and export access.",

  ambulances:
    "Ambulance list, creation, editing, project assignment, team assignment, GPS, and archiving.",

  destinations:
    "Hospitals and destination locations used during patient transportation.",

  clinics: "Clinic module access and management.",

  roaming: "Roaming units access and assignment.",

  transport:
    "Transport and coverage request workflow approvals and operations.",

  client_portal: "External client portal shell and home page.",

  client_cases:
    "Client case request creation, own-case viewing, and tracking.",

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
  view_assigned: "View Assigned",

  create: "Create",
  edit: "Edit",
  update: "Update",
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

  project_case: "Project Case",
  b2c_case: "B2C Case",

  confirm_payment: "Confirm Payment",
  change_team: "Change Team",
  activate_cad: "Create / Activate CAD",

  cancel: "Cancel",

  acknowledge: "Acknowledge",
  report: "Report",
  edit_own: "Edit Own",
  edit_all: "Edit All",

  review: "Review",
  return_for_correction: "Return for Correction",
  manage_expiry: "Manage Expiry",
  manage_templates: "Manage Templates",
};

export const PERMISSION_GROUPS = [
  {
    title: "Operations",
    modules: [
      "dashboards",
      "call_intake",
      "b2c_requests",
      "projects",
      "cases",
      "cad",
      "b2c_cases",
      "missions",
      "crew_profile",
      "readiness_checklists",
      "epcr",
      "submissions",
    ],
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
