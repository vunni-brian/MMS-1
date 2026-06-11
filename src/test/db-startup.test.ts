import { describe, expect, it } from "vitest";

import { canConnectToDatabase } from "../../server/lib/db.ts";

describe("database startup checks", () => {
  it("reports an unavailable database as not connectable", async () => {
    await expect(
      canConnectToDatabase("postgresql://postgres:postgres@127.0.0.1:1/mms"),
    ).resolves.toBe(false);
  });
});
