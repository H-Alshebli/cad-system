# Medical review — staged rollout

## Status

Implemented locally and copied to the desktop checkout at the user's explicit
request; **no production deployment performed by the assistant**. The user reported
a successful emulator run and verified sandbox review-history access after updating
sandbox rules. Automated regression tests and TypeScript checks were rerun on the
desktop copy. Production deployment still requires coordinated application/rules
rollout and verification of production server credentials. No real patient records
or stored roles were read or changed by the assistant; historical migration remains pending.

## Workflow

Finalize saves the draft first, then calls an authenticated server endpoint. The
server revalidates mandatory fields and consent. A successful submission stays
`finalized`/locked for operational case closure but gets a separate
`medicalReview.status = pending`. Closing a case does not confer medical approval.

Medical Review in the sidebar shows all projects. Configure access through Roles
& Permissions, module `epcr_medical_review`: View, Review (comments), Approve,
Return for Correction. Admin/super-admin retain automatic access. No director ID
or role title is hardcoded. Future project scopes need an additional explicit
authorization design; the present module is intentionally organization-wide.

Comments leave reports locked. Approval leaves reports locked. Return requires a
reason and unlocks the same report; resubmission creates a new immutable revision,
not another ePCR. Temporarily, authenticated administrators may approve their own
submission or return it with a mandatory reason; audit events explicitly mark
administrator self-approval/self-return. Other users cannot self-approve or self-return.
Review history is expanded by default and independently shows loading, empty,
permission-denied, or connection-error states with a retry button. Saving a comment
does not dismiss a history-read error. Deployed environment rules must still allow
reviewEvents reads; this UI change does not deploy or bypass those rules.
Review decisions do not change the CAD case status. History and submission copies
are server-only writes. Stable request IDs deduplicate retries; revision checks
reject stale decisions. Queue presence is the current in-app delivery mechanism;
external notifications/email/push are not added.

My Missions and My Missions+ show a live Reports Needing Correction section above
operational tasks. Responsibility follows medicalReview.submittedBy (the last
authenticated submitter), not a subsequently reassigned ambulance. It includes
closed cases, shows report/case numbers, return reason/date and the existing ePCR
link, and removes entries when resubmitted. The subscription is scoped to this user;
loading/errors are distinct from zero tasks. No case status is changed. Test with
`node scripts/test-epcr-correction-tasks-offline.cjs` using synthetic records.

Submissions (detailed view), PDF, and basic/full Excel expose medical review
separately from ePCR and case status. Old reports without review metadata display
Not reviewed, never an inferred approval.

## Security changes

`firestore.rules` is based on the user-supplied rules; unrelated collection access
is preserved. User self-registration is restricted to inactive `none` accounts.
Only administrators can change roles/account activation. Authorized ambulance and
project management can still change ambulanceIds/updatedAt, but not roles or active.
Crew attachment review retains an explicit field allowlist. Review metadata,
submission state, histories, and locked reports cannot be mutated directly by any
client, including admin clients; use the authenticated server workflow.

The user-management API now checks active/non-client/revoked accounts and replaces
role-name regex privileges with explicit permissions. Role grants and account-state
changes require admin, even if another role has Users/Edit. Test HR review workflows
before rollout; do not silently grant new privileges to existing roles.

This is not a complete organization-wide privacy audit. Existing active-user read
scope and operational writes outside ePCR remain as supplied. Existing role grants
should be reviewed by an authorized administrator because previous rules allowed
unrestricted user updates; this implementation does not certify existing grants.

Firebase server SDKs bypass rules, so the API authenticates and authorizes separately:
https://firebase.google.com/docs/firestore/security/rules-fields

## Historical cutoff (no migration run)

Before 2026-09-01 00:00 Asia/Riyadh (2026-08-31 21:00 UTC): eligible for historical
approval only after completeness/submission and the actual case-date source are
verified. At/after the cutoff: medical review required. Unknown dates, import time,
missing reports, or incomplete drafts are not auto-approved. The pure candidate
classifier does not read or write records. A metadata-only aggregate preview and
explicit approval are still required before building/running the historical migration.
Existing reports without review metadata are not in the new pending queue yet.

## Tests and rollout gate

Run offline tests: `node scripts/test-medical-review-offline.cjs`,
`node scripts/test-medical-review-panel-offline.cjs`,
`node scripts/test-review-auth-offline.cjs`, existing draft/creation/export/PDF tests,
and `npx tsc --noEmit --incremental false`.

Firestore emulator test: use Java 21 and run from a normal PowerShell terminal:

Shortcut on this workstation: `powershell -NoProfile -File scripts/test-review-security.ps1`.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm exec --yes --package firebase-tools@14.17.0 -- firebase emulators:exec --project demo-hcad-review --only firestore --config firebase.review-test.json "node scripts/test-firestore-review-emulator.cjs"
```

The test refuses any host other than 127.0.0.1:8089 and uses a demo project, fake
accounts and synthetic documents. No login or production environment is needed.
In the current app-hosted terminal the emulator failed before rules loaded with
Java `Unable to establish loopback connection` / `Invalid argument: connect`.
Offline policy tests do **not** substitute for passing the emulator security suite.

After passing emulator tests, use sandbox-only accounts: crew, a separate reviewer,
admin, and unauthorized/inactive users. Verify registration, ambulance assignment,
HR attachment updates, missing consent, offline recovery, two simultaneous reviews,
return/resubmit, same report number, queue/PDF/Excel, and operational case closure.
Rules and application must be rolled out together (old direct-client finalize will
be denied by the new rules). Do not deploy either to production until these gates
pass and the user explicitly authorizes production rollout.
