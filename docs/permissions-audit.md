# HCAD permissions audit and migration map

Status: sandbox design baseline. This document does not migrate or remove any
stored role permissions.

## Design rules

Every user-facing module must expose permissions in this order:

1. **Access**: whether the module is available.
2. **Data scope**: exactly one of Own, Assigned, Assigned Projects, or All when
   the module contains scoped records.
3. **Actions**: Create, Edit Details, Assign, Update Status, Approve, Close,
   Cancel, Archive, Delete Permanently, Import, or Export as applicable.
4. **Sensitive access**: financial, medical, identity, audit, and destructive
   capabilities displayed separately with a risk indicator.

Enabling an action must also enable module access. Scope options are mutually
exclusive. A module must not display actions that are not enforced by its UI
and server/API path.

## Current permission classification

### Keep as current keys

- `call_intake`: access and case-type creation.
- `b2c_requests`: current request-before-CAD workflow.
- `missions`: assigned field missions and their operational actions.
- `missions_plus`: independent access to the enhanced experience; actions
  continue to use `missions`.
- `crew_profile`: employee self-service and HR-wide profile access.
- `readiness_checklists`: checklist creation, submission, and review workflow.
- `checklist_review_global`: organization-wide review page access only.
- `epcr`: ePCR workflow and sensitive medical data.
- `submissions`: consolidated submission review and historical import.
- `transport`: coverage request workflow.
- `client_portal`, `client_cases`, `client_dashboards`: client-only experience.
- `it_support`: external IT support access.

### Consolidate in the new UI without deleting stored keys

Display one **CAD Cases** module backed by the existing keys:

| New UI control | Existing stored permission |
| --- | --- |
| Access CAD Cases | `cad_cases_new.view` |
| Assigned Cases | `cad_cases_new.view_assigned` |
| All Cases | `cad_cases_new.view_all` |
| Create Case | `cases.create` |
| Edit Case Details | `cases.edit` |
| Assign / Dispatch | `cases.assign` and `cad.dispatch` |
| Update Status | `cases.update_status` and `cad.manage_status` |
| Close Case | `cases.close` |
| Delete Permanently | `cases.delete` |
| View Timeline | `cad.view_timeline` |
| Internal Chat | `cad.internal_chat` |

`cases.view`, `cases.view_all`, `cases.view_own`, and `cad.view` remain readable
for compatibility during migration, but are not presented as competing modern
access controls.

### Move to Legacy Compatibility

- `cad_cases_old`: legacy CAD page access.
- `b2c_cases`: previous B2C workflow.

Legacy permissions remain stored and functional until the corresponding pages
are formally retired.

## Permission gaps found

### Roles administration

- `/admin/roles` is guarded by `roles.view`, but create, edit, and delete are
  currently performed directly from the client without independent UI checks.
- `/admin/roles/[roleId]` is a second legacy editor and does not use the shared
  permission guard.
- Role writes need an authenticated server API enforcing `roles.create`,
  `roles.edit`, and `roles.delete`.
- Role deletion does not currently prevent deleting a role assigned to users.
- Editing a role name can create a second role rather than performing a safe
  rename and reassignment.

### Users administration

- The page uses `users.view` for access and `users.edit` for most account and
  role-review actions.
- `users.create`, `users.activate`, `users.deactivate`, and `users.delete` are
  declared but are not consistently used as independent controls.
- Permanent suspended-account deletion is intentionally admin-only on the
  server and should be displayed as a sensitive admin override, not as a
  normal role permission unless policy changes.

### Employee entitlements

The current `employee_entitlements.send` permission controls too many unrelated
actions. Add separate permissions before exposing the new builder:

- `edit_draft`
- `correct_sent`
- `resolve_adjustment`
- `relink_account`
- `view_audit_history`

Keep `view_own` and `respond` as employee self-service permissions, but clearly
mark their current default-enabled behavior.

### Projects and resources

- Project access uses `projects.view`; list scope uses `projects.view_all`.
- Project creation and editing are checked, but assign, archive, and delete are
  not consistently enforced as independent actions.
- Project hospital creation currently relies on `projects.edit`, overlapping
  with `destinations.create`.
- Ambulance page access is checked with `ambulances.view`; individual create,
  edit, assign, archive, and delete enforcement needs to be made consistent.

### Labels missing from the current UI dictionary

These actions currently fall back to their technical keys in the interface:

- `send`
- `respond`
- `edit_own_draft`
- `submit`

All action labels must come from one approved vocabulary before the matrix UI
is introduced.

## Existing behavior that must be made explicit

- Admin and super-admin roles bypass stored role permissions and receive all
  permissions.
- `it_support.view` defaults to enabled unless explicitly saved as false.
- `employee_entitlements.view_own` and `employee_entitlements.respond` default
  to enabled unless explicitly saved as false.
- Consequently, **Clear All** does not currently produce zero enabled
  permissions.
- Role document IDs are exact and case-sensitive; user role values must match
  them exactly.
- Applying a preset replaces the in-memory permission map rather than merging
  it, although it does not persist until Save is pressed.

## Proposed UI views

### Permissions Matrix

- Modules are collapsible sections.
- Rows are roles and columns are standardized controls.
- The role-name column and permission headers remain sticky.
- Scope is a radio choice, not independent checkboxes.
- Clicking a role opens the Role Builder.
- Matrix changes remain staged until Review Changes and Save.

### Role Builder

- Left rail: roles, user count, role type, and permission count.
- Main panel: Access, Data Scope, Actions, and Sensitive Access.
- Footer: unsaved-change count, discard, review, and save.
- Presets show a diff and require choosing Merge or Replace.
- Delete is blocked while users are assigned to the role.

## Safe implementation sequence

1. Introduce standardized display metadata without changing stored keys.
2. Add the read-only comparison matrix and consolidated CAD presentation.
3. Add protected role-management APIs and audit history.
4. Enforce currently declared action permissions in UI and APIs.
5. Add missing entitlement permissions and migrate existing HR roles safely.
6. Enable staged matrix editing and the Role Builder.
7. Validate representative Dispatcher, Paramedic/EMT, Physician, HR, Project
   Manager, and Client roles before production rollout.

