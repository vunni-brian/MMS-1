import { run } from "./db.ts";
import { HttpError } from "./http.ts";
import { hashPassword, nowIso } from "./security.ts";
import { updateSupabaseAuthUser } from "./supabase.ts";

export const validatePasswordStrength = (password: string) => {
  if (!password) {
    throw new HttpError(400, "A password is required.");
  }
  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters long.");
  }
};

export const applyUserPassword = async (
  user: {
    id: string;
    auth_user_id: string | null;
    email: string;
    phone: string;
    name: string;
    role: "vendor" | "manager" | "official";
    market_id: string | null;
  },
  newPassword: string,
) => {
  validatePasswordStrength(newPassword);

  if (user.auth_user_id) {
    await updateSupabaseAuthUser(user.auth_user_id, {
      email: user.email,
      phone: user.phone,
      password: newPassword,
      localUserId: user.id,
      name: user.name,
      role: user.role,
      marketId: user.market_id,
    });
  }

  await run(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [hashPassword(newPassword), nowIso(), user.id]);
};

export const revokeUserSessions = async ({
  userId,
  exceptTokenHash,
}: {
  userId: string;
  exceptTokenHash?: string;
}) => {
  if (exceptTokenHash) {
    await run(`DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`, [userId, exceptTokenHash]);
    return;
  }

  await run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
};

export const buildVendorPasswordResetMessage = ({
  temporaryPassword,
  reason,
  appUrl,
}: {
  temporaryPassword: string;
  reason: string;
  appUrl: string;
}) =>
  `Your password was reset by market support. Reason: ${reason}. Temporary password: ${temporaryPassword}. Sign in at ${appUrl} and change it immediately.`;
