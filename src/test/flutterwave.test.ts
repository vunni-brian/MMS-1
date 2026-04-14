import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { isValidFlutterwaveWebhook } from "../../server/lib/flutterwave.ts";

describe("Flutterwave webhook signing", () => {
  it("accepts a valid HMAC signature", () => {
    const rawBody = JSON.stringify({ id: "evt_123", data: { tx_ref: "flwtx_1" } });
    const secretHash = "test-secret";
    const signature = crypto.createHmac("sha256", secretHash).update(rawBody).digest("base64");

    expect(
      isValidFlutterwaveWebhook({
        rawBody,
        signature,
        secretHash,
      }),
    ).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(
      isValidFlutterwaveWebhook({
        rawBody: '{"id":"evt_123"}',
        signature: "wrong-signature",
        secretHash: "test-secret",
      }),
    ).toBe(false);
  });
});
