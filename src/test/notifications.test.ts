import { afterEach, describe, expect, it, vi } from "vitest";

import { sendSmsDelivery } from "../../server/lib/sms.ts";

describe("sendSmsDelivery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts to the sandbox API when enabled", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        SMSMessageData: {
          Recipients: [{ status: "Success", number: "+256700100200" }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendSmsDelivery("+256700100200", "Test message", {
      africasTalkingUsername: "sandbox",
      africasTalkingApiKey: "key-123",
      africasTalkingFrom: "MMS",
      africasTalkingUseSandbox: true,
      africasTalkingSmsEnabled: true,
      devMode: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sandbox.africastalking.com/version1/messaging");
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        apiKey: "key-123",
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    expect(request.body).toBeInstanceOf(URLSearchParams);
    expect(request.body.toString()).toBe("username=sandbox&to=%2B256700100200&message=Test+message&from=MMS");
  });

  it("throws the provider error message when the API request fails", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ message: "Invalid API key" }),
      }),
    );

    await expect(
      sendSmsDelivery("+256700100200", "Test message", {
        africasTalkingUsername: "sandbox",
        africasTalkingApiKey: "bad-key",
        africasTalkingFrom: null,
        africasTalkingUseSandbox: true,
        africasTalkingSmsEnabled: true,
        devMode: true,
      }),
    ).rejects.toThrow("Africa's Talking SMS delivery failed: Invalid API key");
  });

  it("throws when a recipient is returned with a non-success status", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          SMSMessageData: {
            Recipients: [{ status: "Failed", number: "+256700100200" }],
          },
        }),
      }),
    );

    await expect(
      sendSmsDelivery("+256700100200", "Test message", {
        africasTalkingUsername: "sandbox",
        africasTalkingApiKey: "key-123",
        africasTalkingFrom: null,
        africasTalkingUseSandbox: false,
        africasTalkingSmsEnabled: true,
        devMode: true,
      }),
    ).rejects.toThrow("Africa's Talking SMS delivery failed: Failed for +256700100200");
  });

  it("falls back to logging when SMS delivery is not configured", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await sendSmsDelivery("+256700100200", "Test message", {
      africasTalkingUsername: null,
      africasTalkingApiKey: null,
      africasTalkingFrom: null,
      africasTalkingUseSandbox: false,
      africasTalkingSmsEnabled: false,
      devMode: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("[delivery:sms:fallback]", "+256700100200", "Test message");
  });
});
