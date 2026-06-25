# TODO - UI review fixes

## ✅ Step 1 (Done)
- [x] Implement Option A for `AdminAlertsPage` loading policy: wait for all alert-related queries to settle successfully, avoiding partial-table jumpiness.
- [x] Add aggregated error state if any query errors.

## ✅ Step 2 (Done)
- [x] Fix landing language links in `src/pages/Index.tsx`: replace `href="#"` with safe behavior (preventDefault if placeholders).
- [x] Fix `href="#"` placeholders in `LoginPage.tsx` and `ForgotPasswordPage.tsx` footer links.

## Step 3 (Conditional — on hold)
- [ ] Audit/adjust `AdminAlertsPage` responsive layout (`admin-alert-layout` / `admin-alert-side-panel`) once styling sources are confirmed.

## Step 4 (Conditional — on hold)
- [ ] Improve `AppLayout` search shortcut trigger to use supported CommandMenu open behavior.

## Lint fixes
- [x] Fix 49 `no-constant-condition` lint errors in `src/test/verification/api-auth.test.ts` (replaced `if (1)` with plain blocks).


