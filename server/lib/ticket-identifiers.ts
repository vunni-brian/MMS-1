/**
 * @file Ticket number generation.
 * Calls a PostgreSQL function (`generate_ticket_number()`) that atomically
 * produces the next sequential ticket ID.
 */

import { get } from "./db.ts";

/** Atomically generate the next sequential ticket number via the DB function. */
export const generateTicketNumber = async () => {
  const row = await get<{ ticket_number: string }>("SELECT generate_ticket_number() AS ticket_number");
  if (!row?.ticket_number) {
    throw new Error("Unable to generate ticket number.");
  }
  return row.ticket_number;
};

/** Generate a child reference (`A` for assignment, `C` for comment) for a ticket. */
export const generateTicketChildReference = async (ticketNumber: string, prefix: "A" | "C") => {
  const row = await get<{ reference: string }>(
    "SELECT generate_ticket_child_reference(?, ?) AS reference",
    [ticketNumber, prefix],
  );
  if (!row?.reference) {
    throw new Error(`Unable to generate ticket ${prefix} reference.`);
  }
  return row.reference;
};

/** Derive an escalation reference string from a ticket number. */
export const getEscalationReference = (ticketNumber: string) => `${ticketNumber}-ESC`;
/** Derive a resolution reference string from a ticket number. */
export const getResolutionReference = (ticketNumber: string) => `${ticketNumber}-RES`;
