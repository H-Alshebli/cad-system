// lib/permissionsMatrix.ts

export type PermissionsMap = Record<string, Record<string, boolean>>;

export const PERMISSION_MATRIX: Record<string, string[]> = {
  dashboards: ["view", "timeline", "epcr", "epcr_legacy", "executive", "all_data"],

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

  // Sidebar/page visibility controls for the parallel CAD experiences.
  cad_cases_new: ["view", "view_all", "view_assigned"],
  cad_cases_old: ["view"],

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
    "create_project_case",
    "acknowledge",
    "update_status",
    "report",
  ],

  // Enhanced missions experience. Operational actions continue to use the
  // shared missions permissions; this permission independently controls access.
  missions_plus: ["view"],

  crew_profile: ["view", "edit_own", "view_all", "edit_all"],

  employee_entitlements: [
    "view_own",
    "view_all",
    "import",
    "send",
    "respond",
    "export",
  ],

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

  // Controls visibility of the organization-wide checklist review page.
  // Checklist data and actions remain protected by readiness_checklists.
  checklist_review_global: ["view"],

  epcr: [
    "view",
    "view_dashboard",
    "create",
    "edit",
    "finalize",
    "export_pdf",
    "view_sensitive",
  ],

  submissions: ["view", "export", "import"],

  // Controls visibility of the external Lazem IT support desk link.
  it_support: ["view"],

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
  cases: "CAD Case Operations",
  cad: "CAD / Dispatch",
  cad_cases_new: "CAD Cases – New",
  cad_cases_old: "CAD Cases – Old",
  call_intake: "Call Intake",

  b2c_cases: "B2C Cases",
  b2c_requests: "B2C Requests",

  missions: "My Missions",
  missions_plus: "My Missions+",
  crew_profile: "Crew Profile",
  employee_entitlements: "Employee Entitlements",
  readiness_checklists: "Readiness Checklists",
  checklist_review_global: "Checklist Review – All Projects",
  epcr: "ePCR",
  epcr_legacy: "Legacy Cases Dashboard",
  submissions: "Submissions",
  it_support: "IT Support",
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

  cad_cases_new:
    "Show the modern CAD Cases module. View All exposes every case; View Assigned limits users to cases where they are recorded as crew participants.",

  cad_cases_old:
    "Show the legacy CAD Cases module for compatibility and comparison.",

  call_intake:
    "Dispatcher intake screen for project calls and B2C customer calls.",

  b2c_cases:
    "Old B2C case permissions kept for compatibility with earlier system logic.",

  b2c_requests:
    "B2C request workflow before CAD activation, including payment confirmation, request editing, planned ambulance/team changes, and CAD creation.",

  missions:
    "Assigned missions for paramedics and field teams, including acknowledgement and status updates.",

  missions_plus:
    "Show the enhanced My Missions+ experience. Mission actions still follow My Missions permissions.",

  crew_profile:
    "Crew member personal, employment, license, contact, and bank profile data.",

  employee_entitlements:
    "Overtime and per diem imports, HR distribution, employee acknowledgment, disputes, and audit history.",

  readiness_checklists:
    "Project EMS readiness checks linked to missions, units, shifts, inspectors, and supervisor review.",
  checklist_review_global:
    "Organization-wide checklist review page covering all projects. Checklist actions still follow the Readiness Checklists permissions.",

  epcr:
    "ePCR access, editing, finalization, PDF export, and sensitive medical details.",

  submissions:
    "Case and ePCR submission review, consolidated visibility, and export access.",

  it_support:
    "Open the Lazem IT ticketing portal in a separate browser tab.",

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
  create_project_case: "Create Project Case",
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
      "cad_cases_new",
      "cad_cases_old",
      "b2c_cases",
      "missions",
      "missions_plus",
      "crew_profile",
      "employee_entitlements",
      "readiness_checklists",
      "checklist_review_global",
      "epcr",
      "submissions",
      "it_support",
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
      if (moduleKey === "it_support" && action === "view") {
        // IT support is available to employee roles by default. Saving an
        // explicit false value on a role is the opt-out control.
        normalized[moduleKey][action] =
          permissions?.[moduleKey]?.[action] !== false;
        return;
      }

      if (
        moduleKey === "employee_entitlements" &&
        (action === "view_own" || action === "respond")
      ) {
        // Employee self-service access is enabled by default and can be
        // explicitly disabled on a role. Server APIs still restrict users to
        // their own records and exclude client accounts.
        normalized[moduleKey][action] =
          permissions?.[moduleKey]?.[action] !== false;
        return;
      }

      normalized[moduleKey][action] = Boolean(
        permissions?.[moduleKey]?.[action]
      );
    });
  });

  return normalized;
}

export function normalizeRolePermissions(permissions: PermissionsMap = {}, role?: string | null) {
  const normalized = normalizePermissions(permissions);
  const crewRole = /paramedic|ambulance|response.?team|medical.?team|driver|emt|crew/i.test(String(role || ""));
  const source = permissions?.cad_cases_new || {};
  const hasExplicitScope = typeof source.view_all === "boolean" || typeof source.view_assigned === "boolean";
  if (source.view === true && !hasExplicitScope) {
    normalized.cad_cases_new[crewRole ? "view_assigned" : "view_all"] = true;
  }
  if (
    crewRole &&
    permissions?.missions?.view === true &&
    typeof permissions?.missions?.create_project_case !== "boolean"
  ) {
    normalized.missions.create_project_case = true;
  }
  return normalized;
}
