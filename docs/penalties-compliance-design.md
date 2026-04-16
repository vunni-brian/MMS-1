# Penalties and Compliance Enforcement

## Overview

The system was enhanced to include a penalties mechanism to support regulatory oversight and vendor compliance. A penalty is a financial charge issued to a vendor because of non-compliance, such as late utility settlement, overdue payment behavior, or another market policy violation.

Penalties are treated as structured billable records and are settled through the existing Pesapal payment workflow.

## Penalty Entity

Each penalty record stores:

- unique penalty identifier
- vendor and market
- optional related utility charge
- amount
- reason
- status: unpaid, pending, paid, or cancelled
- issuing official or administrator
- created, updated, and paid timestamps

## Workflow

1. An official or administrator issues a penalty with a clear reason and amount.
2. The vendor is notified through the notification system.
3. The vendor views the penalty in the Payments page.
4. The vendor initiates payment through Pesapal.
5. The penalty becomes pending while payment is being processed.
6. After Pesapal confirms completion, the payment is marked completed and the penalty becomes paid.
7. If the payment fails, the penalty returns to unpaid and can be retried.

## Business Rules

- A penalty must include a reason and amount.
- Only officials and administrators can issue penalties.
- Vendors can only pay penalties assigned to them.
- A penalty cannot be modified after payment.
- Payment completion must be confirmed by the payment gateway before a penalty is marked paid.

## Benefit

This adds a compliance enforcement layer to the system and makes the official role more meaningful. Officials can now monitor market compliance, issue penalties, and track whether penalties have been paid.
