import type { ServerResponse } from "node:http";

import { describe, expect, it } from "vitest";

import { sendError } from "../../server/lib/http.ts";

describe("sendError", () => {
  it("returns a service-unavailable response for PostgreSQL connection failures", () => {
    const captured: { statusCode?: number; body?: string } = {};
    const res = {
      writeHead: (statusCode: number) => {
        captured.statusCode = statusCode;
      },
      end: (body?: string) => {
        captured.body = body;
      },
    } as unknown as ServerResponse;

    const error = new AggregateError([
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" }),
    ], "Database connection failed");

    sendError(res, error);

    expect(captured.statusCode).toBe(503);
    expect(captured.body).toContain("Database unavailable");
  });
});
