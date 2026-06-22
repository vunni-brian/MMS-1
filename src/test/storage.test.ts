/**
 * Tests for file-upload payload validation on the server.
 * Ensures malformed base64 and size-mismatched payloads are rejected.
 */
import { describe, expect, it } from "vitest";

import { persistFilePayload } from "../../server/lib/storage.ts";

describe("storage payload validation", () => {
 it("rejects malformed base64 uploads before persisting", async () => {
 await expect(
 persistFilePayload("test-uploads", "user_1", {
 name: "document.pdf",
 mimeType: "application/pdf",
 size: 12,
 base64: "not a valid payload",
 }),
 ).rejects.toThrow("Uploaded file payload is invalid.");
 });

 it("rejects uploads whose declared size does not match the decoded payload", async () => {
 await expect(
 persistFilePayload("test-uploads", "user_1", {
 name: "document.pdf",
 mimeType: "application/pdf",
 size: 12,
 base64: Buffer.from("abc").toString("base64"),
 }),
 ).rejects.toThrow("Uploaded file size does not match the payload.");
 });
});
