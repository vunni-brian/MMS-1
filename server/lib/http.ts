import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppConfig, SessionAuth } from "../types.ts";
import { logger } from "./logger.ts";
import { nowIso } from "./security.ts";

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  config: AppConfig;
  params: Record<string, string>;
  auth: SessionAuth | null;
}

export interface RouteDefinition {
  method: string;
  path: string;
  handler: (context: RouteContext) => Promise<void> | void;
}

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const MAX_REQUEST_BODY_BYTES = 25 * 1024 * 1024;

const isLocalhostOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
};

export const setCorsHeaders = (req: IncomingMessage, res: ServerResponse, config: AppConfig) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigin =
    requestOrigin && (config.appUrls.includes(requestOrigin) || isLocalhostOrigin(requestOrigin))
      ? requestOrigin
      : config.appUrl;

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
};

export const sendJson = (res: ServerResponse, statusCode: number, payload: unknown) => {
  res.writeHead(statusCode, jsonHeaders);
  res.end(JSON.stringify(payload));
};

export const sendEmpty = (res: ServerResponse, statusCode = 204) => {
  res.writeHead(statusCode);
  res.end();
};

const isDatabaseConnectionError = (error: unknown) => {
  const candidates = [error];

  if (error instanceof AggregateError) {
    candidates.push(...error.errors);
  }

  return candidates.some((candidate) => {
    const message = candidate instanceof Error ? candidate.message : String(candidate);
    const code = candidate && typeof candidate === "object" && "code" in candidate ? String((candidate as { code?: unknown }).code) : "";

    return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message) || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(code);
  });
};

export const sendError = (res: ServerResponse, error: unknown) => {
  if (error instanceof HttpError) {
    return sendJson(res, error.statusCode, {
      error: error.message,
      details: error.details ?? null,
      timestamp: nowIso(),
    });
  }

  if (isDatabaseConnectionError(error)) {
    return sendJson(res, 503, {
      error: "Database unavailable. Start PostgreSQL and verify DATABASE_URL.",
      timestamp: nowIso(),
    });
  }

  logger.error("Unhandled request error", error instanceof Error ? error : undefined, { error: String(error) });
  return sendJson(res, 500, {
    error: "Internal server error.",
    timestamp: nowIso(),
  });
};

export const readJsonBody = async <T>(req: IncomingMessage): Promise<T> => {
  const rawBody = await readRawBody(req);
  if (!rawBody) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch (error) {
    throw new HttpError(400, "Invalid JSON payload.", error);
  }
};

export const readRawBody = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return "";
  }

  return Buffer.concat(chunks).toString("utf8");
};

export const matchRoute = (routePath: string, pathname: string) => {
  const routeParts = routePath.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (routeParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index];
    const pathPart = pathParts[index];
    if (routePart.startsWith(":")) {
      params[routePart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }
    if (routePart !== pathPart) {
      return null;
    }
  }

  return params;
};

export const getBearerToken = (req: IncomingMessage) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
};
