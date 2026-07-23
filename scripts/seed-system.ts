import { PERMISSION_MATRIX, normalizePermissions } from "../lib/permissionsMatrix";
import { runSeed, type SeedDocument } from "./seed-lib";

const SYSTEM_SEED_SOURCE = "hcad-system-seed" as const;

function allPermissions() {
  const permissions: Record<string, Record<string, boolean>> = {};

  Object.entries(PERMISSION_MATRIX).forEach(([moduleKey, actions]) => {
    permissions[moduleKey] = {};
    actions.forEach((action) => {
      permissions[moduleKey][action] = true;
    });
  });

  return normalizePermissions(permissions);
}

function roleDocument(roleId: string, permissions: Record<string, Record<string, boolean>>): SeedDocument {
  return {
    collection: "roles",
    id: roleId,
    seedSource: SYSTEM_SEED_SOURCE,
    description: `role definition for ${roleId}`,
    data: {
      name: roleId,
      permissions: normalizePermissions(permissions),
    },
  };
}

function permissionSubset(
  entries: Array<[string, string[]]>
): Record<string, Record<string, boolean>> {
  const permissions: Record<string, Record<string, boolean>> = {};

  entries.forEach(([moduleKey, actions]) => {
    permissions[moduleKey] = {};
    actions.forEach((action) => {
      permissions[moduleKey][action] = true;
    });
  });

  return permissions;
}

function optionalAdminProfile(): SeedDocument[] {
  const uid = process.env.HCAD_SEED_ADMIN_UID?.trim();
  const email = process.env.HCAD_SEED_ADMIN_EMAIL?.trim();
  const name = process.env.HCAD_SEED_ADMIN_NAME?.trim() || "Sandbox Admin";

  if (!uid || !email) return [];

  return [
    {
      collection: "users",
      id: uid,
      seedSource: SYSTEM_SEED_SOURCE,
      description: "initial Sandbox admin Firestore profile",
      data: {
        uid,
        name,
        email,
        active: true,
        role: "admin",
      },
    },
  ];
}

const dispatcherPermissions = permissionSubset([
  ["dashboards", ["view", "timeline", "epcr"]],
  ["call_intake", ["view", "create", "project_case", "b2c_case"]],
  [
    "b2c_requests",
    [
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
  ],
  ["b2c_cases", ["view", "create", "confirm_payment", "assign", "cancel"]],
  ["cases", ["view", "view_all", "create", "edit", "assign", "update_status", "close"]],
  ["cad", ["view", "dispatch", "manage_status", "view_timeline", "internal_chat"]],
  ["missions", ["view", "view_assigned"]],
  ["ambulances", ["view"]],
  ["projects", ["view"]],
  ["destinations", ["view"]],
  ["location_picker", ["view"]],
]);

const paramedicPermissions = permissionSubset([
  ["missions", ["view", "view_assigned", "acknowledge", "update_status", "report"]],
  [
    "readiness_checklists",
    ["view", "view_own", "create", "edit_own_draft", "submit"],
  ],
  ["b2c_requests", ["view", "view_assigned"]],
  ["cases", ["view", "view_own", "update_status"]],
  ["epcr", ["view", "create", "edit", "finalize"]],
  ["crew_profile", ["view", "edit_own"]],
  ["location_picker", ["view"]],
]);

const clientPermissions = permissionSubset([
  ["client_portal", ["view"]],
  ["client_cases", ["view", "view_own", "create", "track"]],
  ["client_dashboards", ["timeline", "epcr"]],
]);

const operationsManagerPermissions = permissionSubset([
  ["dashboards", ["view", "timeline", "epcr", "executive", "all_data"]],
  ["projects", ["view", "view_all", "create", "edit", "assign", "archive"]],
  ["cases", ["view", "view_all", "create", "edit", "assign", "update_status", "close"]],
  ["cad", ["view", "dispatch", "manage_status", "view_timeline", "internal_chat"]],
  ["call_intake", ["view", "create", "project_case", "b2c_case"]],
  ["b2c_requests", ["view", "view_all", "edit", "update", "activate_cad", "cancel"]],
  ["missions", ["view", "view_assigned", "acknowledge", "update_status", "report"]],
  ["readiness_checklists", ["view", "view_all", "review", "approve", "return_for_correction"]],
  ["epcr", ["view", "view_dashboard", "export_pdf", "view_sensitive"]],
  ["ambulances", ["view", "create", "edit", "assign", "archive"]],
  ["destinations", ["view", "create", "edit"]],
  ["clinics", ["view", "create", "edit"]],
  ["roaming", ["view", "create", "edit", "assign"]],
  ["transport", ["view", "approve", "ops", "assign", "export"]],
  ["crew_profile", ["view", "view_all", "edit_all"]],
  ["reports", ["view", "export"]],
  ["users", ["view", "edit", "activate", "deactivate"]],
  ["roles", ["view"]],
  ["location_picker", ["view"]],
]);

const documents: SeedDocument[] = [
  roleDocument("admin", allPermissions()),
  roleDocument("dispatcher", dispatcherPermissions),
  roleDocument("paramedic", paramedicPermissions),
  roleDocument("client", clientPermissions),
  roleDocument("operations_manager", operationsManagerPermissions),
  {
    collection: "systemConfiguration",
    id: "sandbox",
    seedSource: SYSTEM_SEED_SOURCE,
    description: "safe Sandbox environment marker",
    data: {
      environment: "sandbox",
      displayName: "HCAD Sandbox",
      productionDataAllowed: false,
      demoDataAllowed: true,
    },
  },
  {
    collection: "systemConfiguration",
    id: "permissionDefinitions",
    seedSource: SYSTEM_SEED_SOURCE,
    description: "permission matrix snapshot used by HCAD UI",
    data: {
      permissions: PERMISSION_MATRIX,
    },
  },
  ...optionalAdminProfile(),
];

const approvedApplyDocuments = process.argv.includes(
  "--exclude-system-configuration"
)
  ? documents.filter((document) => document.collection !== "systemConfiguration")
  : documents;

runSeed("system", approvedApplyDocuments).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
