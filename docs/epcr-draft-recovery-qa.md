# ePCR draft recovery and Submissions QA

## Scope

- Autosave updates the existing ePCR document; it never creates a case/report.
- Edits are queued into encrypted IndexedDB immediately; server saves debounce for 1.2 seconds.
- Same-origin links and report form navigation save before leaving. Missing consent saves a draft before redirecting; it never finalizes automatically.
- Reconnect retries while the editor is open. If the app was closed, reopen the report with the same account, browser profile, and site to recover/sync. This is not closed-browser background delivery.
- Mutation IDs handle an uncertain server acknowledgement without repeating that write. Transactions reject changed or locked server versions. One browser editor owns the report via Web Locks.
- Conflicts stop sync and retain the local draft for review rather than overwriting either version. Administrative conflict-resolution UI is not part of this change.
- Local recovery is deleted after acknowledged server saving. Unsynced recovery is retained. Do not clear site data or use private browsing for durable recovery.

## Security limits

Recovery uses AES-GCM with a non-exportable, origin-local key scoped by Firebase project and account. This reduces plaintext storage exposure, but does not protect against XSS or someone controlling the device/browser profile. Use trusted managed devices. Storage denial/quota failures display an explicit warning. No real patient records were read during implementation/testing.

## Submissions

Project-name filtering and inclusive date/time bounds apply to case creation time in the device timezone. Export includes all matching records, not just the current page. Responsive cards are the default; the full-width detailed table remains optional. Pagination is 50 entries per page.

## Automated checks

Run `node scripts/reproduce-epcr-status-offline.cjs` and `node scripts/reproduce-epcr-creation-offline.cjs`. The first runs the hook with in-memory server/vault mocks: recovery, reconnect, repeated/concurrent saves, lost acknowledgement, conflicts, locked reports, save before consent, repeated finalization, quota failure, account isolation, snapshot preservation, and date bounds. Type-check with `npx tsc --noEmit --incremental false`.

The isolated localhost QA fixture renders the actual Submissions component with synthetic data and exercises the actual IndexedDB encryption module in a browser. It does not connect to Firebase. Visual checks at desktop and 390px width passed. The fixture is static SSR: filter interactions and full authenticated navigation still require the sandbox acceptance test below.

## Sandbox acceptance before deployment

1. Open a synthetic draft, edit, and wait for `Saved to server`. Reload and verify.
2. Edit and open Data Sharing Consent directly; return and verify the edits remain.
3. Fill all required fields, leave consent incomplete, and press Finalize. Confirm a draft save then the consent prompt. Complete consent and return, then finalize.
4. Disconnect internet after loading a synthetic draft. Edit and wait for `Saved on this device`. Reconnect with the editor open; expect `Saved to server`, the same ePCR ID, and no extra case/report.
5. Reopen an offline-saved report on the same account/browser; verify recovery. A full offline reload also requires cached app assets.
6. Open the same report in another tab: it must not become a second editor. Check a conflict from another device stops sync rather than replacing edits.
7. Check project/date/time filters, reset, CSV export, detailed table, and small-screen layout.

These local checks do not replace authenticated sandbox validation of Firestore permissions, PWA caching, and complete form/navigation behavior. No deployment was performed.
