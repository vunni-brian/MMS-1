import { get } from "./db.ts";

export const generateTicketNumber = async () => {
  const row = await get<{ ticket_number: string }>("SELECT generate_ticket_number() AS ticket_number");
  if (!row?.ticket_number) {
    throw new Error("Unable to generate ticket number.");
  }
  return row.ticket_number;
};

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

export const getEscalationReference = (ticketNumber: string) => `${ticketNumber}-ESC`;
export const getResolutionReference = (ticketNumber: string) => `${ticketNumber}-RES`;
