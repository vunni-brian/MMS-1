# TODO - UI review fixes

## Step 1 (Approved)
- [x] Implement Option A for `AdminAlertsPage` loading policy: wait for all alert-related queries to settle successfully, avoiding partial-table jumpiness.
- [ ] Add aggregated error state if any query errors.

## Step 2 (Approved)
- [ ] Fix landing language links in `src/pages/Index.tsx`: replace `href="#"` with safe behavior (preventDefault if placeholders).

## Step 3 (Conditional)
- [ ] Audit/adjust `AdminAlertsPage` responsive layout (`admin-alert-layout` / `admin-alert-side-panel`) once styling sources are confirmed.

## Step 4 (Conditional)
- [ ] Improve `AppLayout` search shortcut trigger to use supported CommandMenu open behavior.


