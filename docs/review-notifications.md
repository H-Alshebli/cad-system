# Review notifications — staged, not activated

## Scope

New ePCR submissions notify opted-in medical reviewers. Comment, approval and
return notify the last submitter. New checklist submissions notify opted-in
checklist reviewers; decisions/comments notify the inspector. Each channel uses
the same durable event. Email contains only the event category and authenticated
application link: no names, clinical data, signatures or comment text.

Permissions are configured through Roles & Permissions: `receive_notifications`
under ePCR Medical Review or Readiness Checklists. Explicit opt-in is required even
for admins. It does not grant review access. Checklist recipients must satisfy
existing visibility (view_all, or view/view_own on their own checklist) and review
permission; there is currently no separate project-assigned reviewer policy.

Shared checklist templates/calculations were moved unchanged into
`lib/readinessChecklistCore.ts`, re-exported from the original module. This lets
the authenticated server validate and calculate submissions without loading client
Firebase. Creation/submission/review are server-only; own draft edits remain
client-side, constrained by rules. The server records review comments as events.

## Activation prerequisites (do not execute against production yet)

1. Pass TypeScript, synthetic tests and the LOCAL Firestore emulator. Then test
   sandbox checklist creation/draft/review, ePCR, two recipients and email delivery.
2. Deploy application and matching Firestore rules together; refresh old clients.
   Do not deploy only the rules: legacy checklist clients write submissions directly
   and will be rejected. Existing reads and ePCR lifecycle policy are unchanged.
3. Configure reviewer role opt-ins through the UI before activating delivery.
4. Reuse existing SMTP_HOST/PORT/USER/PASS/FROM in the runtime. Never expose secrets
   through NEXT_PUBLIC variables or logs. Configure REVIEW_NOTIFICATION_ORIGIN
   to the HTTPS application origin (sandbox origin in sandbox).
5. Configure REVIEW_NOTIFICATION_WORKER_SECRET (32+ random characters) via Secret
   Manager. A scheduled HTTPS POST to `/api/review-notifications/deliver` must use
   `Authorization: Bearer <secret>`. Do not include the secret in source or chat.
   The endpoint performs writes/sends; do not call it as a diagnostic read.
6. Provision a scheduler (e.g. once per minute) only with deployment approval.
   Scheduler/Firestore/email usage can incur costs; no scheduler is provisioned by
   this change. Use request timeout sufficient for a bounded batch; start with
   one invocation at a time. Concurrent calls are guarded per event and mail job.
7. Set REVIEW_NOTIFICATIONS_START_AT to an explicit future ISO datetime with a
   timezone; deploy all revisions before that time. Set REVIEW_NOTIFICATIONS_ENABLED
   to `true`. Missing/invalid boundary prevents event creation. Default is off.
   Cohort uses ePCR submittedAt and server-owned checklist notificationCohortAt.
   Old records are not scanned/backfilled; old pending records do not start sending
   alerts on a comment. A genuine new resubmission after the boundary is a new event.

## Delivery and limits

Lifecycle and outbox writes share a transaction. Worker fanout creates each
recipient's inbox record and mail job atomically with deterministic IDs. It works
when browsers are closed; the inbox is available after login on any device.
Inbox shows the latest 30 notices with mark-as-read. It is not browser push.

Each worker invocation handles at most 20 events and 20 mail jobs. More than 80
recipients or no eligible recipients produces `blocked_recipient_limit` or
`blocked_no_recipients`, never silent loss. After correcting role opt-ins, an
operator must inspect and explicitly requeue blocked events. Default-deny rules
prevent browser writes to the outbox and mail queue.

SMTP offers no exactly-once guarantee. Explicit temporary SMTP rejections retry
with a five-minute delay, up to five attempts. Ambiguous failure is marked
`delivery_unknown`; a crash after claiming leaves `sending`. Neither is automatically
retried because the email may already have been accepted. Check the provider's
delivery record using the deterministic Message-ID before any manual retry.
Missing SMTP configuration leaves mail pending without blocking inbox delivery.
`sent` means accepted by SMTP, not proof that the recipient read/received it.
Permissions/account activation/email are rechecked before mail delivery.

Operational follow-up must monitor blocked, failed, delivery_unknown and stale
sending jobs; this version has no admin queue-management screen. Do not erase
idempotency records or retry uncertain jobs blindly. Checklist creation duplicate
keys persist after checklist deletion; manual cleanup requires case-by-case review.

## Verification

Run `node scripts/test-review-notifications-offline.cjs`,
`node scripts/test-medical-review-offline.cjs`, and
`node scripts/test-review-auth-offline.cjs`. These use synthetic state, not SMTP or
Firebase. Run `npx tsc --noEmit --incremental false`.
`scripts/test-firestore-review-emulator.cjs` also covers recipient isolation and
server-only checklist transitions; run only through the established local emulator
wrapper `scripts/test-review-security.ps1` (demo-hcad-review, 127.0.0.1:8089).

Sandbox acceptance: future cutoff excludes earlier submissions; two workers or
repeated submit never duplicate inbox events; reviewer receives submit; inspector
receives comment/return/approve; inactive/unsubscribed users receive no new mail;
returned resubmission works; disabled SMTP keeps inbox working; failed send does
not rollback submission. An ordinary employee cannot forge lifecycle events or
read another user's inbox. No production notifications are sent by tests.
