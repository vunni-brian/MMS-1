import { describe, expect, it } from "vitest";

import { sendError } from "../../server/lib/http.ts";

describe("sendError", () => {
  it("returns a service-unavailable response for PostgreSQL connection failures", () => {
    const res = {
      writeHead: (statusCode: number) => {
        (res as unknown as { statusCode: number }).statusCode = statusCode;
      },
      end: (body?: string) => {
        (res as unknown as { body?: string }).body = body;
      },
    } as any;

    const error = new AggregateError([
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" }),
    ], "Database connection failed");

    sendError(res, error);

    expect((res as any).statusCode).toBe(503);
    expect((res as any).body).toContain("Database unavailable");
  });
});
