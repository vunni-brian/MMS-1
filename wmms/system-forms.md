# System Forms

This list is based on the current frontend pages and dialogs in the project.

## Public and Authentication Forms

1. Sign-in form
- Fields: phone number, password
- File: `src/pages/LoginPage.tsx`

2. Privileged MFA verification form
- Fields: OTP code
- File: `src/pages/LoginPage.tsx`

3. Vendor phone verification form
- Fields: OTP code
- File: `src/pages/LoginPage.tsx`

4. Vendor registration details form
- Fields: profile photo, full name, NIN/ID number, district, product section, market, phone number, email, password
- File: `src/pages/RegisterPage.tsx`

5. Vendor registration document upload form
- Fields: national ID upload/photo, LC letter upload
- File: `src/pages/RegisterPage.tsx`

6. Vendor registration OTP verification form
- Fields: OTP code
- File: `src/pages/RegisterPage.tsx`

## Vendor and Shared Workspace Forms

7. Complaint submission form
- Fields: category, subject, description, attachment
- File: `src/pages/shared/ComplaintsPage.tsx`

8. Profile update form
- Fields: profile photo, full name, email, phone number, product section, market
- File: `src/pages/shared/ProfileSettingsPage.tsx`

9. Password change form
- Fields: current password, new password, confirm new password
- File: `src/pages/shared/ProfileSettingsPage.tsx`

10. Preferences form
- Fields: dense tables, receipt-first payments, remember filters
- File: `src/pages/shared/ProfileSettingsPage.tsx`

11. Notification settings form
- Fields: in-app notifications, SMS notifications, payment alerts, complaint updates, approval alerts
- File: `src/pages/shared/ProfileSettingsPage.tsx`

12. Payment initiation form/dialog
- Purpose: starts checkout for booking fees, utilities, and penalties
- File: `src/pages/shared/PaymentsPage.tsx`

## Manager and Oversight Forms

13. Vendor application review form
- Fields/actions: manager notes, reject reason, approve vendor, reject vendor
- File: `src/pages/manager/VendorsPage.tsx`

14. Vendor status reset form
- Fields: reset reason
- File: `src/pages/manager/VendorsPage.tsx`

15. Complaint update form
- Fields: status, resolution note, manager note
- File: `src/pages/shared/ComplaintsPage.tsx`

16. Coordination post update form
- Fields: market scope (when applicable), subject, message body
- File: `src/pages/shared/CoordinationPage.tsx`
