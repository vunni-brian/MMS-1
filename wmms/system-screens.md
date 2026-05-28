# System Screens and Role-Based UI/UX Review

## 1. Introduction

This document identifies the major screens in the Market Management System, maps them to the user roles that access them, and evaluates how the interface supports role-based workflows. It is intended for system documentation, supervisor review, and presentation appendices where both functional coverage and interface quality must be demonstrated.

The review focuses on four areas:

- Major public and authenticated screens.
- Role-based route separation and access behavior.
- Interface structure, workflow emphasis, and usability.
- Shared UI/UX patterns that support consistency across the system.

## 2. System Navigation Architecture

The application uses a role-aware navigation model. Public screens are available before authentication, while operational screens are protected by role-based route guards. Once authenticated, each user enters a dedicated workspace shell that exposes only the pages and actions relevant to that role.

Authenticated screens share a consistent layout pattern: a left-side navigation menu, top workspace controls, profile access, notification access, and a main content area. This shared shell improves learnability across roles while still allowing each role to receive a different screen set, action density, and operational focus.

Notification access is standardized through the profile notification tab. Compatibility routes such as `/vendor/notifications`, `/manager/notifications`, `/official/notifications`, and `/admin/notifications` redirect users to the relevant profile notification view. This keeps notification management centralized while preserving intuitive route behavior.

## 3. Public Screens

### Landing Page (`/`)

**Purpose:**
Introduces the system and provides the initial access point for users.

**Primary Components:**

- System name and entry message.
- Navigation toward authentication.
- Basic public-facing system identity.

**UX Characteristics:**

- Minimal layout that avoids distracting unauthenticated users.
- Clear transition path toward login or registration.
- Lightweight structure suitable for quick system access.

### Login Page (`/login`)

**Purpose:**
Authenticates vendors and staff using phone credentials, with optional MFA or OTP verification when required.

**Primary Components:**

- Phone number input.
- Password field.
- Password visibility toggle.
- MFA or OTP verification step.
- Vendor registration shortcut.
- Inline authentication error feedback.

**UX Characteristics:**

- Centered authentication card improves focus and reduces visual noise.
- Clear form hierarchy supports fast credential entry.
- Password visibility control improves usability without weakening security behavior.
- Mobile-friendly spacing makes the screen suitable for field users.

### Vendor Registration Page (`/register`)

**Purpose:**
Captures vendor onboarding information and supporting documents before account approval.

**Primary Components:**

- Vendor contact details.
- Market and product section selection.
- National ID number and district fields.
- Profile image upload.
- National ID document upload.
- LC letter upload.
- OTP verification flow after submission.

**UX Characteristics:**

- Grouped form sections reduce onboarding complexity.
- Document upload controls are positioned close to identity information, supporting logical data entry.
- Validation and verification steps help prevent incomplete registrations.
- The form supports the full vendor onboarding workflow without requiring staff intervention at entry point.

### Payment Callback Page (`/payments/callback`)

**Purpose:**
Displays the result of a payment flow after a user returns from the payment gateway.

**Primary Components:**

- Payment status message.
- Receipt or transaction feedback.
- Recovery or navigation actions after payment completion.

**UX Characteristics:**

- Focused confirmation design reduces ambiguity after checkout.
- Status feedback helps users understand whether payment was completed, pending, or failed.
- The page supports trust by making gateway outcomes visible inside the system.

### Not Found Page (`*`)

**Purpose:**
Handles invalid or inaccessible routes.

**Primary Components:**

- 404 message.
- Current route context.
- Return actions.

**UX Characteristics:**

- Provides recovery actions instead of leaving users on a blank page.
- Reduces confusion when users access outdated or unauthorized links.
- Supports route robustness in a single-page application.

## 4. Vendor Workspace

### 4.1 Workspace Purpose

The vendor workspace is a lightweight self-service environment focused on daily operational activities. It allows vendors to monitor stall status, pay dues, read notices, submit complaints, and maintain profile information without needing direct staff assistance for routine tasks.

### 4.2 Screen Inventory

| Screen | Route | Core Functions |
| --- | --- | --- |
| Vendor Dashboard | `/vendor` | Displays greeting, balance, stall status, pending payments, unread notices, open complaints, quick tasks, recent notices, and recent payments. |
| Stalls | `/vendor/stalls` | Shows available stalls, assigned stall details, reservation state, application status, pricing, and status badges. |
| Payments | `/vendor/payments` | Presents outstanding dues, utility charges, penalties, payment actions, receipt upload, and payment history. |
| Complaints | `/vendor/complaints` | Supports complaint submission, complaint register review, status tracking, ticket details, and follow-up visibility. |
| Notices | `/vendor/announcements` | Displays active and archived market notices from managers or administrators. |
| Notifications | `/vendor/notifications` | Redirects to `/vendor/profile?tab=notifications` for account notifications and notification preferences. |
| Profile | `/vendor/profile` | Provides general information, profile image, market assignment, security settings, notification preferences, billing preferences, and account details. |

### 4.3 UI/UX Evaluation

The vendor interface prioritizes simplicity, readability, and direct task completion. Dashboard cards surface immediate obligations such as pending dues, stall status, unresolved complaints, and unread notices. Action density is intentionally low to reduce cognitive overload for non-technical users and occasional system users.

Status badges, compact summaries, and short action buttons improve scan efficiency. Pending vendors receive approval progress indicators and restricted operational actions, which clarifies why some workflows remain unavailable before manager approval. This design supports transparency while preventing unauthorized access to payment and stall operations.

## 5. Market Manager Workspace

### 5.1 Workspace Purpose

The market manager workspace supports market-level operations, queue management, vendor supervision, payment follow-up, stall allocation, complaint resolution, and communication with officials. It is designed for users who repeatedly review, approve, update, and resolve operational records.

### 5.2 Screen Inventory

| Screen | Route | Core Functions |
| --- | --- | --- |
| Manager Dashboard | `/manager` | Displays approval queues, payment follow-ups, open complaints, market health, occupancy data, utility due totals, and active task tabs. |
| Vendors | `/manager/vendors` | Provides vendor directory, pending applications, document review, approval/rejection actions, activity timeline, and password reset support. |
| Stalls | `/manager/stalls` | Manages stall inventory, creation forms, allocation status, availability, zones, rental prices, and booking review workflow. |
| Payments | `/manager/payments` | Shows payment records, pending receipts, transaction references, verification state, and fee-related history. |
| Complaints | `/manager/complaints` | Supports complaint queue review, filtering, ticket status updates, comments, escalation, and resolution controls. |
| Billing | `/manager/billing` | Displays market-level utility charges, penalties, billing visibility, and charge follow-up information. |
| Reports | `/manager/reports` | Provides revenue, dues, audit, financial, and operational report sections scoped to the manager's market. |
| Audit | `/manager/audit` | Shows activity history for market operations and evidence review. |
| Coordination | `/manager/coordination` | Supports coordination messages and resource request creation for official review. |
| Notices | `/manager/announcements` | Enables notice creation, audience targeting, active notice review, and archive review. |
| Notifications | `/manager/notifications` | Redirects to `/manager/profile?tab=notifications` for notification management. |
| Profile | `/manager/profile` | Provides manager identity, security, notification preferences, user preferences, and account settings. |

### 5.3 UI/UX Evaluation

The manager interface is optimized for operational throughput. It uses queues, tabs, filters, cards, dialogs, and status badges to help managers move quickly between review and action. The dashboard emphasizes decisions that need attention, including vendor approvals, booking applications, payment follow-ups, complaints, and utility obligations.

Compared with the vendor interface, the manager workspace has higher information density because the role requires repeated comparison and decision-making. The navigation groups dashboard, workspace, operations, and settings areas so managers can move from summary views to detailed evidence screens with minimal navigation depth.

## 6. Official Workspace

### 6.1 Workspace Purpose

The official workspace provides authority-level oversight across markets. It supports compliance monitoring, resource request review, financial visibility, audit inspection, and coordination with market managers.

### 6.2 Screen Inventory

| Screen | Route | Core Functions |
| --- | --- | --- |
| Official Dashboard | `/official` | Displays market monitoring, market filters, active market counts, vendor counts, monthly revenue, open complaints, pending reviews, and risk indicators. |
| Billing | `/official/billing` | Provides read-oriented billing, utility, penalty, and payment tracking across markets. |
| Reports | `/official/reports` | Presents market overview reports, revenue summaries, dues reporting, financial audit, and analytics. |
| Audit | `/official/audit` | Shows inspection evidence, compliance activity, operational history, and traceable audit records. |
| Coordination | `/official/coordination` | Supports resource request review, manager messages, official responses, and coordination history. |
| Notices | `/official/announcements` | Displays notices visible to officials and broader communication records. |
| Notifications | `/official/notifications` | Redirects to `/official/profile?tab=notifications` for notification management. |
| Profile | `/official/profile` | Provides official identity, security settings, notification preferences, and account settings. |

### 6.3 UI/UX Evaluation

The official interface is supervisory rather than transaction-heavy. It emphasizes cross-market visibility, exception monitoring, compliance evidence, and review workflows. Aggregate KPI panels, market filters, data tables, and risk/status badges help officials compare markets and identify where intervention may be required.

Most official surfaces are read-oriented, which aligns with oversight responsibilities. Action points are concentrated in coordination and resource request review, reducing the risk of unnecessary operational interference while still supporting governance and accountability.

## 7. Admin Workspace

### 7.1 Workspace Purpose

The admin workspace provides system-level governance and configuration. It supports user administration, market setup, billing controls, integration visibility, reports, audit review, alerts, and cross-market coordination.

### 7.2 Screen Inventory

| Screen | Route | Core Functions |
| --- | --- | --- |
| Admin Dashboard | `/admin` | Displays system overview, attention queue, recent activity, system health, market snapshot, people, payments, and quick actions. |
| Users | `/admin/users` | Supports staff/user management, invitation workflow, role assignment, permission scope, responsibilities, and account governance. |
| Markets | `/admin/markets` | Manages market setup, manager assignment, stall capacity, location hierarchy, and operational status. |
| Alerts | `/admin/alerts` | Shows system attention items, payment exceptions, operational warnings, and alert rules. |
| Integrations | `/admin/integrations` | Displays payment, SMS, reporting, storage, and platform integration status. |
| Settings | `/admin/settings` | Provides runtime settings, notification rules, security posture, and system configuration controls. |
| Billing | `/admin/billing` | Manages global and market billing controls, charge type toggles, utility controls, penalty controls, and payment gateway availability. |
| Reports | `/admin/reports` | Provides system-wide reporting, financial audit, revenue, dues, and operational summaries. |
| Audit | `/admin/audit` | Shows full activity logs, actor details, entity evidence, and governance records. |
| Coordination | `/admin/coordination` | Provides cross-market coordination messages and resource/request visibility. |
| Notices | `/admin/announcements` | Supports system-level notices, audience targeting, publication state, and archived communication. |
| Notifications | `/admin/notifications` | Redirects to `/admin/profile?tab=notifications` for notification management. |
| Profile | `/admin/profile` | Provides admin identity, security settings, notification preferences, and account settings. |

### 7.3 UI/UX Evaluation

The admin workspace is intentionally the densest interface because administrators manage governance, configuration, and cross-market visibility. It uses compact navigation, restrained panels, data tables, status badges, and short action buttons to support high-frequency administrative workflows.

The dashboard prioritizes system health, flagged exceptions, recent activity, people, payments, and market status. This structure helps administrators identify systemic issues before moving into deeper management screens such as users, markets, integrations, billing, reports, and audit evidence.

## 8. Role-Based Interface Strategy

The system applies differentiated interface density and interaction behavior depending on operational responsibility. This role-aware interface strategy reduces cognitive overload while ensuring each user category interacts primarily with relevant operational information.

| Role | Interface Strategy | Design Justification |
| --- | --- | --- |
| Vendor | Simple, action-led, low-density interface. | Vendors need fast access to personal obligations, payments, stall information, notices, and complaints without administrative complexity. |
| Market Manager | Queue-led, task-oriented operational interface. | Managers need to compare records, make decisions, resolve issues, and process daily market workflows efficiently. |
| Official | Oversight-led monitoring interface. | Officials need cross-market visibility, compliance evidence, risk indicators, and request review rather than routine transaction controls. |
| Admin | High-density governance and configuration interface. | Administrators need broad system visibility, control surfaces, auditability, and management tools across all markets and roles. |

This differentiation demonstrates alignment between user responsibility and interface behavior. The system avoids a one-size-fits-all dashboard and instead adapts visual density, navigation options, and available actions to each role.

## 9. Shared Design System Patterns

The system maintains consistency through reusable interface patterns across all workspaces.

| Pattern | Usage |
| --- | --- |
| Ubuntu typography | Provides rounded, readable text across headings and body content, matching the intended visual style. |
| Role-aware shell | Keeps sidebar navigation, workspace header behavior, profile access, and notifications consistent across authenticated screens. |
| Status badges | Communicate payment, booking, complaint, approval, and risk states quickly. |
| Compact cards | Summarize key operational metrics without overwhelming users. |
| Data tables | Support comparison-heavy workflows such as users, audit logs, payments, reports, and market data. |
| Dialogs and sheets | Contain focused actions such as approval, rejection, receipt review, and detailed evidence review. |
| Empty states | Explain when no records exist and prevent screens from appearing broken. |
| Filters and segmented controls | Help users narrow operational data without leaving the current workspace. |
| Notification patterns | Centralize alert review and channel preferences in profile notification tabs. |
| Responsive spacing | Preserves usability across desktop and mobile layouts, especially for vendor and field use cases. |

These patterns create a unified system experience while allowing each role to operate with an appropriate level of complexity.

## 10. Screenshot References

| Screenshot | Description |
| --- | --- |
| Admin Dashboard | Governance, system health, attention queue, people, payments, and market overview. |
| Manager Dashboard | Operational workflow, approval queues, complaints, payment follow-ups, and market health. |
| Official Dashboard | Oversight, compliance monitoring, market comparison, and risk visibility. |
| Vendor Dashboard | Self-service operational workspace for payments, stalls, notices, complaints, and profile access. |
| Mobile Vendor Dashboard | Responsive vendor experience with compact navigation and readable operational summaries. |
| Mobile Navigation Menu | Collapsible role-aware navigation for smaller screens. |

Dashboard screenshots are included in the `wmms/screenshots/` folder. Additional role-based screenshot metadata is available in `docs/requested-screenshots/REQUESTED_SCREENSHOT_INDEX.md`.

## 11. Conclusion

The system implements a role-aware interface architecture designed to support operational efficiency, governance visibility, and user clarity across all stakeholder categories. By tailoring interface density, navigation structure, and workflow emphasis to each role, the platform minimizes unnecessary complexity while improving task completion efficiency and administrative oversight.

The resulting UI/UX structure supports both usability and access control: vendors receive simplified self-service tools, managers receive operational queues, officials receive oversight and compliance views, and administrators receive high-density governance controls. This alignment between interface design and organizational responsibility strengthens the overall system architecture.
