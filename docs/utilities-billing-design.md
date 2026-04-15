# Utilities Billing System Design

This document captures the intended utilities billing extension for the Market Management System. It is a design note for the next billing phase, not a description of functionality that already exists in the current codebase.

## Overview

To address the limitations identified during system testing regarding unclear utility billing and lack of structured payment handling, the system should be extended to support a dedicated utilities billing mechanism. This design introduces a clear separation between billable charges and payment transactions, aligning the platform with real-world financial systems.

In this model:

- A utility charge represents a bill issued to a vendor.
- A payment represents the transaction used to settle that bill through the Pesapal integration.

## Utilities Billing Principle

Utility charges should be based on actual or assigned usage. Vendors should pay only for the utilities they consume or are allocated, rather than a uniform fixed amount for all users. The system should support both usage-based billing and fixed utility service charges, depending on the type of utility and market policy.

This means the billing model should support:

- metered billing where exact consumption is recorded
- estimated billing where usage is allocated using an approved distribution method
- fixed billing for utilities or service charges that are not consumption-based

## System Design

### Utility Charges Entity

A new `utility_charges` entity should be introduced to manage utility billing independently from payments. Each record should represent a specific charge assigned to a vendor.

Recommended attributes:

- unique identifier for each utility charge
- vendor associated with the charge
- market in which the charge is issued
- stall or booking reference where applicable
- utility type such as electricity, water, or sanitation
- charge description
- billing period such as January 2026
- usage quantity where applicable
- usage unit such as `kWh`, `litres`, or `stall`
- rate per unit where applicable
- calculation method: `metered`, `estimated`, or `fixed`
- total amount payable
- due date
- charge status: `unpaid`, `pending`, `paid`, `overdue`, or `cancelled`
- timestamps for creation, update, and payment confirmation

This design keeps utility billing clear, traceable, and defensible.

### Utility Billing Formula

Where usage-based charging applies, the total charge should be derived using:

`Total Utility Charge = Usage Quantity x Rate Per Unit`

Example:

- Utility Type: Electricity
- Usage Quantity: 120
- Unit: kWh
- Rate Per Unit: UGX 500
- Total Amount: UGX 60,000
- Billing Period: January 2026

### Relationship with Payments

The existing `payments` entity should remain the transaction layer and be extended to reference utility charges.

- each payment may be linked to a utility charge through a reference field
- a utility charge may have one or more payment attempts
- a payment is only valid after confirmation from the payment gateway

This separation supports:

- clear distinction between what is owed and what has been paid
- better auditability and reporting
- retry of failed transactions without duplicating the original charge

## Workflow

### 1. Utility Charge Creation

A manager or administrator creates a utility charge by specifying:

- vendor
- utility type
- billing period
- usage details or fixed-charge basis
- amount
- due date

On creation:

- the charge is assigned status `unpaid`
- the vendor is notified of the new charge

### 2. Vendor Payment Process

The vendor opens the utilities section and views:

- utility type
- billing period
- usage basis
- amount
- due date
- current status

The vendor then initiates payment through the system, which triggers the Pesapal flow.

### 3. Payment Processing

Upon payment initiation:

- a payment record is created with status `pending`
- the linked utility charge status is updated to `pending`

The vendor is redirected to the Pesapal payment interface to complete the transaction.

### 4. Payment Confirmation

Once the payment gateway confirms the transaction:

- the payment status is updated to `completed`
- the utility charge status is updated to `paid`
- the payment timestamp is recorded
- the vendor receives a confirmation notification
- an audit event is generated

### 5. Failed or Incomplete Payments

If the payment fails or is abandoned:

- the payment status is marked `failed`
- the utility charge reverts to `unpaid`
- the vendor may retry the payment

### 6. Overdue Charges

If a charge remains unpaid after the due date:

- the system updates the charge status to `overdue`
- the vendor is notified accordingly

## User Interface Integration

### Vendor Interface

The vendor should have a dedicated utilities section showing:

- assigned utility charges
- usage basis and calculation method
- due dates
- payment status
- available actions such as `Pay`, `Retry`, and `View Receipt`

### Manager Interface

Managers should be able to:

- create and assign utility charges
- view utility payment status
- manage charges within their assigned market

### Official and Admin Interface

Officials and administrators should have read-oriented access to:

- utility billing records
- payment confirmations
- market-level utility summaries

## Business Rules

The utilities billing extension should follow these rules:

- a utility charge must exist before a related payment can be initiated
- a paid charge cannot be modified or deleted
- only authorized roles such as manager or admin can create utility charges
- vendors may pay only the charges assigned to them
- payment completion must be confirmed through the payment gateway
- duplicate pending payments for the same utility charge are not allowed
- market-specific pricing variation is supported
- billing may be metered, estimated, or fixed depending on utility type and market policy

## Benefits

This design provides:

- clear separation between billing and payment processes
- stronger financial traceability and auditability
- support for multiple utility types and recurring charges
- better user experience through transparent billing rules
- flexibility for market-based pricing variation and future reporting

## Presentation Summary

For presentation or defense, the utilities billing principle can be stated as:

> The system bills vendors for utilities based on actual or assigned usage. Where metering is available, the charge is calculated from consumption and rate per unit. Where metering is not available, the system supports estimated or fixed service charges depending on market policy.
