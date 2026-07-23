# HCAD Sandbox Seeding

This document describes the read-safe, idempotent seeding framework for HCAD Sandbox, demo, development, and future UAT environments.

The seed framework must never be used with Production credentials, Production Firebase projects, or copied Production operational data.

## Scripts

### System Seed

```bash
npm run seed:system
```

Dry-run only by default. It proposes mandatory system/reference records:

- `roles/admin`
- `roles/dispatcher`
- `roles/paramedic`
- `roles/client`
- `roles/operations_manager`
- `systemConfiguration/sandbox`
- `systemConfiguration/permissionDefinitions`
- optional `users/{HCAD_SEED_ADMIN_UID}` when admin seed variables are configured

The system seed does not create operational demo cases.

### Demo Seed

```bash
npm run seed:demo
```

Dry-run only by default. It proposes fictional records for demonstration:

- Sandbox users
- destinations
- ambulances
- projects
- cases across common CAD statuses
- one draft ePCR linked to a demo case
- one transport request
- one Partner API booking and idempotency marker

## Required Environment Variables

Minimum dry-run/apply safety variables:

```bash
HCAD_SEED_ENV=sandbox
HCAD_SEED_ALLOWED_PROJECT_IDS=<sandbox-firebase-project-id>
FIREBASE_ADMIN_PROJECT_ID=<sandbox-firebase-project-id>
```

Required for `--apply` writes:

```bash
FIREBASE_ADMIN_CLIENT_EMAIL=<sandbox-service-account-email>
FIREBASE_ADMIN_PRIVATE_KEY=<sandbox-service-account-private-key>
```

Optional first admin profile:

```bash
HCAD_SEED_ADMIN_UID=<firebase-auth-uid>
HCAD_SEED_ADMIN_EMAIL=<sandbox-admin@example.com>
HCAD_SEED_ADMIN_NAME="Sandbox Admin"
```

Optional production block-list:

```bash
HCAD_SEED_PRODUCTION_PROJECT_IDS=<production-project-id>
```

Do not print or commit private keys, API keys, service account JSON, or Production identifiers.

## Dry-Run Procedure

Dry-run is the default mode and makes no Firebase writes:

```bash
npm run seed:system
npm run seed:demo
```

For local dry-run without Firebase credentials, you may pass explicit non-production placeholders:

```bash
npm run seed:system -- --env=sandbox --project-id=<sandbox-project-id> --allowed-project-ids=<sandbox-project-id>
npm run seed:demo -- --env=sandbox --project-id=<sandbox-project-id> --allowed-project-ids=<sandbox-project-id>
```

## Apply Procedure

Apply requires explicit approval and `--apply`:

```bash
npm run seed:system:apply
npm run seed:demo:apply
```

Never run apply against Production. Never run apply until dry-run output has been reviewed.

## Safety Checks

The scripts refuse to run unless:

- `HCAD_SEED_ENV` or `--env` is one of `sandbox`, `demo`, `development`, `dev`, `uat`, or `local`
- `FIREBASE_ADMIN_PROJECT_ID` or `--project-id` is set
- the project ID is included in `HCAD_SEED_ALLOWED_PROJECT_IDS` or `--allowed-project-ids`
- the project ID is not included in `HCAD_SEED_PRODUCTION_PROJECT_IDS`
- actual writes include `--apply`
- Firebase Admin credentials are present for writes

The scripts do not weaken Firestore Rules or Storage Rules.

## Idempotency

Every seed-managed record has:

```json
{
  "seedSource": "hcad-system-seed or hcad-demo-seed",
  "seedVersion": "1.0"
}
```

Stable document IDs prevent duplicates. Existing non-seed-managed documents are skipped, not overwritten. Existing seed-managed documents from the same seed source may be updated by a later run.

## Expected Collections

System seed:

- `roles`
- `systemConfiguration`
- optional `users`

Demo seed:

- `users`
- `destinations`
- `ambulances`
- `projects`
- `cases`
- `epcr`
- `transport_requests`
- `partnerBookings`
- `partnerBookingIdempotency`

The seed framework does not import Production audit logs, real attachments, real API keys, real patient records, or real employee records.

## Verification

After dry-run review and approved apply:

1. Confirm the Sandbox Firebase project ID.
2. Confirm `roles` contains the baseline role documents.
3. Confirm `users/{adminUid}` exists when first admin variables were configured.
4. Log in to Sandbox using the Firebase Auth admin user.
5. Confirm `/admin/users`, `/admin/roles`, `/projects`, `/ambulances`, and `/cases` load.
6. Confirm every demo record includes `seedSource` and `seedVersion`.

## Adding Future Seed Versions

Add new stable document IDs and keep old IDs stable. If a new seed version changes a record shape, update `seedVersion` and keep the same `seedSource`. Do not delete data from seed scripts. Any reset/delete workflow must be designed, reviewed, and approved separately.

## Rollback Limitations

There is no automatic rollback. The scripts intentionally do not delete data. If seeded records must be removed, design a separate explicit reset command with strict approval and project safeguards.

## UAT and Customer Demo Support

The same framework can support future UAT and customer demo environments by:

- adding the non-production project ID to the allow-list
- using fictional demo data only
- using a dedicated service account for that environment
- setting `HCAD_SEED_ENV=uat` or `HCAD_SEED_ENV=demo`

Production data remains prohibited in every seed mode.
