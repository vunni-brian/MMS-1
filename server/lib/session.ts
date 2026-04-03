import { get, run, createId, getAuthUserById } from "./db.ts";
import { HttpError } from "./http.ts";
import { addHours, hashToken, isExpired, nowIso } from "./security.ts";
import { hasPermission } from "./permissions.ts";
import { config } from "../config.ts";
import type { Permission, SessionAuth } from "../types.ts";

export const authenticateToken = async (token: string | null) => {
  if (!token) {
    return null;
  }

  const session = await get<{ user_id: string; expires_at: string }>(
    `SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`,
    [hashToken(token)],
  );

  if (!session) {
    return null;
  }

  if (isExpired(session.expires_at)) {
    void run(`DELETE FROM sessions WHERE token_hash = ?`, [hashToken(token)]);
    return null;
  }

  const user = await getAuthUserById(session.user_id);
  if (!user) {
    return null;
  }

  return { token, user } satisfies SessionAuth;
};

export const requireAuth = (auth: SessionAuth | null) => {
  if (!auth) {
    throw new HttpError(401, "Authentication required.");
  }
  return auth;
};

export const requirePermission = (auth: SessionAuth | null, permission: Permission) => {
  const session = requireAuth(auth);
  if (!hasPermission(session.user.role, permission)) {
    throw new HttpError(403, "You do not have permission to perform this action.");
  }
  return session;
};

export const resolveScopedMarket = (
  auth: SessionAuth | null,
  permission: Permission,
  requestedMarketId?: string | null,
) => {
  const session = requirePermission(auth, permission);
  if (session.user.role === "official") {
    return {
      session,
      marketId: requestedMarketId?.trim() || null,
    };
  }

  if (!session.user.marketId) {
    throw new HttpError(403, "Your account is not assigned to a market.");
  }
  if (requestedMarketId && requestedMarketId !== session.user.marketId) {
    throw new HttpError(403, "You do not have access to that market.");
  }

  return {
    session,
    marketId: session.user.marketId,
  };
};

export const assertMarketAccess = (session: SessionAuth, resourceMarketId: string | null | undefined) => {
  if (session.user.role === "official") {
    return;
  }
  if (!resourceMarketId || session.user.marketId !== resourceMarketId) {
    throw new HttpError(404, "Resource not found.");
  }
};

export const createSessionForUser = async (userId: string) => {
  const token = createId("session_token");
  const timestamp = nowIso();
  await run(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [createId("session"), userId, hashToken(token), timestamp, addHours(config.sessionTtlHours)],
  );
  return token;
};

export const destroySession = async (token: string) => {
  await run(`DELETE FROM sessions WHERE token_hash = ?`, [hashToken(token)]);
};
