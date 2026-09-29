# Delayed acknowledgement draft conflict

Prepared in the original worktree, separate from the Next 15 sandbox migration.
Not deployed. No production records read or modified.

Confirmed synthetic reproduction: a draft transaction commits, its acknowledgement
is lost, the user makes another edit, and the previous commit's snapshot arrives.
The old code compared only the latest mutation ID and blocked its own earlier save.
This is a reproducible cause, not proof of the particular production incident.

Fix: retain up to eight exact attempted-commit receipts (mutation ID, canonical
draft payload, exact revision/timestamp). Persist them in the existing encrypted
recovery vault before a transaction write. Reconcile only an exact matching,
unlocked server document. The transaction still checks the latest server state.
Changed payload/version or locked/finalized records remain blocked. Local storage
failure is not treated as proof of durable recovery. Legacy drafts have no receipt
history and cannot automatically recover a predecessor mutation using this fix.

Affected files: lib/epcrDraftCore.ts, lib/epcrDraftVault.ts, lib/useEpcrDraft.ts.
Regression: node scripts/reproduce-epcr-self-conflict-offline.cjs
Existing suite: node scripts/test-epcr-draft-offline.cjs

For an already-blocked report with subsequent administrator edits:

1. Preserve both PDFs and the original device/browser recovery store. Do not clear
   storage, overwrite the report, reset its version, or create a duplicate report.
2. An authorized recovery workflow must obtain the full local draft on the same
   authenticated device and compare it to a fresh server document. PDF is not a
   complete machine-readable backup; it cannot establish the original timestamps.
3. Have the responsible clinician confirm field and signature choices. Do not
   automatically promote test zeros or marks into clinical data.
4. Only after explicit confirmation, a version-checked recovery transaction may
   write the reviewed result, retaining an audit and the original recovery copy
   until verification. A changed/locked server version must abort that operation.

Recovery UI is now implemented locally: explicit per-section selection, confirmation,
fresh server comparison, and the ordinary version-checked draft-save transaction.
Both originals and the selection are archived in the encrypted device vault outside
the automatic-restore prefix. This is a local recovery record, not a server audit.
Existing Firestore authorization still governs the write; no rules were widened.
Archives remain on that device and are not durable across storage clearing.
No recovery has been run on production. The user has authorized proceeding with
the PDF as an additional reference; PDF is still not a substitute for a full draft.
Run: node scripts/test-epcr-conflict-recovery-offline.cjs
