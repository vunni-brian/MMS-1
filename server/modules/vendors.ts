import { all, get, getManagerForMarket, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, requireAuth, requirePermission, resolveScopedMarket } from "../lib/session.ts";
import { normalizePhoneNumber, nowIso } from "../lib/security.ts";
import { findSupabaseAuthUser, updateSupabaseAuthUser } from "../lib/supabase.ts";

const vendorSelect = `
  SELECT users.id,
         users.name,
         users.email,
         users.phone,
         users.created_at,
         users.market_id,
         markets.name AS market_name,
         vendor_profiles.approval_status,
         vendor_profiles.approval_reason,
         vendor_profiles.id_document_name,
         vendor_profiles.id_document_path,
         vendor_profiles.id_document_mime_type,
         vendor_profiles.id_document_size
  FROM users
  INNER JOIN vendor_profiles ON vendor_profiles.user_id = users.id
  LEFT JOIN markets ON markets.id = users.market_id
`;

const mapVendor = (row: {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  market_id: string | null;
  market_name: string | null;
  approval_status: string;
  approval_reason: string | null;
  id_document_name: string | null;
  id_document_path: string | null;
  id_document_mime_type: string | null;
  id_document_size: number | null;
}) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  createdAt: row.created_at,
  marketId: row.market_id,
  marketName: row.market_name,
  status: row.approval_status,
  approvalReason: row.approval_reason,
  idDocument: row.id_document_name
    ? {
        name: row.id_document_name,
        storagePath: row.id_document_path,
        mimeType: row.id_document_mime_type,
        size: row.id_document_size,
      }
    : null,
});

const getVendorById = async (vendorId: string) => {
  const vendor = await get<{
    id: string;
    name: string;
    email: string;
    phone: string;
    created_at: string;
    market_id: string | null;
    market_name: string | null;
    approval_status: string;
    approval_reason: string | null;
    id_document_name: string | null;
    id_document_path: string | null;
    id_document_mime_type: string | null;
    id_document_size: number | null;
  }>(`${vendorSelect} WHERE users.id = ?`, [vendorId]);

  return vendor ? mapVendor(vendor) : null;
};

export const vendorRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/vendors",
    handler: async ({ res, auth, url }) => {
      const { marketId } = resolveScopedMarket(auth, "vendor:read", url.searchParams.get("marketId"));
      const params = marketId ? [marketId] : [];
      const vendors = await all<{
        id: string;
        name: string;
        email: string;
        phone: string;
        created_at: string;
        market_id: string | null;
        market_name: string | null;
        approval_status: string;
        approval_reason: string | null;
        id_document_name: string | null;
        id_document_path: string | null;
        id_document_mime_type: string | null;
        id_document_size: number | null;
      }>(`${vendorSelect} ${marketId ? "WHERE users.market_id = ?" : ""} ORDER BY users.created_at DESC`, params);

      sendJson(res, 200, { vendors: vendors.map(mapVendor) });
    },
  },
  {
    method: "GET",
    path: "/vendors/:id",
    handler: async ({ res, auth, params }) => {
      const session = requireAuth(auth);
      const vendor = await getVendorById(params.id);
      if (!vendor) {
        throw new HttpError(404, "Vendor not found.");
      }
      if (session.user.role === "vendor" && session.user.id !== params.id) {
        throw new HttpError(403, "You may only view your own vendor profile.");
      }
      assertMarketAccess(session, vendor.marketId);
      sendJson(res, 200, { vendor });
    },
  },
  {
    method: "PATCH",
    path: "/vendors/:id/profile",
    handler: async ({ req, res, auth, params, config }) => {
      const session = requireAuth(auth);
      if (session.user.role !== "vendor" || session.user.id !== params.id) {
        throw new HttpError(403, "You may only update your own vendor profile.");
      }

      const vendor = await getVendorById(params.id);
      if (!vendor) {
        throw new HttpError(404, "Vendor not found.");
      }

      const userRecord = await get<{ auth_user_id: string | null }>(`SELECT auth_user_id FROM users WHERE id = ?`, [params.id]);
      const body = await readJsonBody<{
        name?: string;
        email?: string;
        phone?: string;
        marketId?: string;
      }>(req);

      const name = body.name?.trim() || vendor.name;
      const email = body.email?.trim().toLowerCase() || vendor.email;
      const phone = body.phone ? normalizePhoneNumber(body.phone) : vendor.phone;
      const marketId = body.marketId?.trim() || vendor.marketId;

      if (!name || !email || !phone || !marketId) {
        throw new HttpError(400, "Name, email, phone, and market are required.");
      }

      const market = await get<{ id: string; name: string }>(`SELECT id, name FROM markets WHERE id = ?`, [marketId]);
      if (!market) {
        throw new HttpError(400, "Selected market is invalid.");
      }

      const duplicatePhone = await get<{ id: string }>(
        `SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1`,
        [phone, params.id],
      );
      if (duplicatePhone) {
        throw new HttpError(409, "A user with that phone number already exists.");
      }

      const duplicateEmail = await get<{ id: string }>(
        `SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1`,
        [email, params.id],
      );
      if (duplicateEmail) {
        throw new HttpError(409, "A user with that email address already exists.");
      }

      const marketChanged = marketId !== vendor.marketId;
      const phoneChanged = phone !== vendor.phone;

      if (marketChanged) {
        const activeStall = await get<{ id: string }>(
          `SELECT id FROM stalls WHERE assigned_vendor_id = ? AND status = 'active' LIMIT 1`,
          [params.id],
        );
        if (activeStall) {
          throw new HttpError(409, "Transfer to another market is only available when you do not have an active stall.");
        }
      }

      if (config.supabaseAuthEnabled && userRecord?.auth_user_id) {
        const matchingSupabaseUser = await findSupabaseAuthUser({ phone, email });
        if (matchingSupabaseUser && matchingSupabaseUser.id !== userRecord.auth_user_id) {
          throw new HttpError(409, "A Supabase Auth user with that phone or email already exists.");
        }

        await updateSupabaseAuthUser(userRecord.auth_user_id, {
          email,
          phone,
          localUserId: params.id,
          name,
          role: "vendor",
          marketId: market.id,
        });
      }

      const timestamp = nowIso();
      await transaction(async () => {
        await run(
          `UPDATE users
           SET name = ?,
               email = ?,
               phone = ?,
               market_id = ?,
               phone_verified_at = ?,
               updated_at = ?
           WHERE id = ?`,
          [name, email, phone, market.id, phoneChanged ? timestamp : session.user.phoneVerifiedAt, timestamp, params.id],
        );

        if (marketChanged) {
          await run(
            `UPDATE vendor_profiles
             SET approval_status = 'pending',
                 approval_reason = NULL,
                 approved_by = NULL,
                 approved_at = NULL,
                 rejected_by = NULL,
                 rejected_at = NULL
             WHERE user_id = ?`,
            [params.id],
          );
          await run(
            `UPDATE bookings
             SET status = 'rejected',
                 reviewed_by_user_id = ?,
                 reviewed_at = ?,
                 review_note = ?,
                 confirmed_at = NULL,
                 updated_at = ?
             WHERE vendor_id = ? AND status = 'pending'`,
            [params.id, timestamp, "Cancelled because the vendor transferred to another market.", timestamp, params.id],
          );
        }
      });

      await queueNotification({
        userId: params.id,
        type: "system",
        message: marketChanged
          ? `Your profile was updated and your transfer to ${market.name} is now awaiting manager approval.`
          : "Your profile details were updated successfully.",
        channels: ["system"],
      });

      if (marketChanged) {
        const marketManager = await getManagerForMarket(market.id);
        if (marketManager) {
          await queueNotification({
            userId: marketManager.id,
            type: "system",
            message: `${name} transferred into ${market.name} and now needs vendor approval.`,
            channels: ["system", "sms"],
            destinationPhone: marketManager.phone,
          });
        }
      }

      await logAuditEvent({
        actorUserId: params.id,
        actorName: name,
        actorRole: "vendor",
        marketId: market.id,
        action: marketChanged ? "TRANSFER_VENDOR_MARKET" : "UPDATE_VENDOR_PROFILE",
        entityType: "vendor",
        entityId: params.id,
        details: {
          previousMarketId: vendor.marketId,
          marketId: market.id,
          phoneChanged,
          emailChanged: email !== vendor.email,
        },
      });

      sendJson(res, 200, {
        vendor: await getVendorById(params.id),
        message: marketChanged
          ? `Profile updated. Transfer to ${market.name} is pending manager approval.`
          : "Profile updated.",
      });
    },
  },
  {
    method: "POST",
    path: "/vendors/:id/approve",
    handler: async ({ req, res, auth, params }) => {
      const session = requirePermission(auth, "vendor:review");
      const vendor = await getVendorById(params.id);
      if (!vendor) {
        throw new HttpError(404, "Vendor not found.");
      }
      assertMarketAccess(session, vendor.marketId);

      const timestamp = nowIso();
      await run(
        `UPDATE vendor_profiles
         SET approval_status = 'approved',
             approval_reason = NULL,
             approved_by = ?,
             approved_at = ?,
             rejected_by = NULL,
             rejected_at = NULL
         WHERE user_id = ?`,
        [session.user.id, timestamp, params.id],
      );

      await queueNotification({
        userId: params.id,
        type: "system",
        message: "Your vendor profile has been approved. You can now sign in and reserve stalls.",
        channels: ["system", "sms"],
        destinationPhone: vendor.phone,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: vendor.marketId,
        action: "APPROVE_VENDOR",
        entityType: "vendor",
        entityId: params.id,
        details: { vendorName: vendor.name },
      });

      await readJsonBody<Record<string, never>>(req);
      sendJson(res, 200, { vendor: await getVendorById(params.id) });
    },
  },
  {
    method: "POST",
    path: "/vendors/:id/reject",
    handler: async ({ req, res, auth, params }) => {
      const session = requirePermission(auth, "vendor:review");
      const vendor = await getVendorById(params.id);
      if (!vendor) {
        throw new HttpError(404, "Vendor not found.");
      }
      assertMarketAccess(session, vendor.marketId);

      const body = await readJsonBody<{ reason?: string }>(req);
      const reason = body.reason?.trim();
      if (!reason) {
        throw new HttpError(400, "A rejection reason is required.");
      }

      const timestamp = nowIso();
      await run(
        `UPDATE vendor_profiles
         SET approval_status = 'rejected',
             approval_reason = ?,
             rejected_by = ?,
             rejected_at = ?,
             approved_by = NULL,
             approved_at = NULL
         WHERE user_id = ?`,
        [reason, session.user.id, timestamp, params.id],
      );

      await queueNotification({
        userId: params.id,
        type: "system",
        message: `Your vendor profile was rejected: ${reason}`,
        channels: ["system", "sms"],
        destinationPhone: vendor.phone,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: vendor.marketId,
        action: "REJECT_VENDOR",
        entityType: "vendor",
        entityId: params.id,
        details: { vendorName: vendor.name, reason },
      });

      sendJson(res, 200, { vendor: await getVendorById(params.id) });
    },
  },
];
