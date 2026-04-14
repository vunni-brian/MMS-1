import { describe, expect, it } from "vitest";

import { getTicketCreationManagerChannels, getVendorTicketNotification } from "../../server/lib/ticket-notifications.ts";

describe("ticket notification rules", () => {
  it("keeps ticket creation alerts in-app only for managers", () => {
    expect(getTicketCreationManagerChannels()).toEqual(["system"]);
  });

  it("sends SMS when a ticket moves into progress", () => {
    expect(
      getVendorTicketNotification({
        previousStatus: "open",
        nextStatus: "in_progress",
        subject: "THEFT",
      }),
    ).toEqual({
      channels: ["system", "sms"],
      message: 'Your ticket "THEFT" is now in progress.',
    });
  });

  it("sends SMS when a ticket is resolved", () => {
    expect(
      getVendorTicketNotification({
        previousStatus: "in_progress",
        nextStatus: "resolved",
        subject: "THEFT",
      }),
    ).toEqual({
      channels: ["system", "sms"],
      message: 'Your ticket "THEFT" is now resolved.',
    });
  });

  it("keeps note-only updates in-app only", () => {
    expect(
      getVendorTicketNotification({
        previousStatus: "in_progress",
        nextStatus: "in_progress",
        subject: "THEFT",
      }),
    ).toEqual({
      channels: ["system"],
      message: 'Your ticket "THEFT" has a new update.',
    });
  });

  it("keeps reopened tickets in-app only", () => {
    expect(
      getVendorTicketNotification({
        previousStatus: "resolved",
        nextStatus: "open",
        subject: "THEFT",
      }),
    ).toEqual({
      channels: ["system"],
      message: 'Your ticket "THEFT" is now open.',
    });
  });
});
