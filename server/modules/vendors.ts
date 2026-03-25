import { all, get, logAuditEvent, queueNotification, run } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, requireAuth, requirePermission, resolveScopedMarket } from "../lib/session.ts";
import { nowIso } from "../lib/security.ts";

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

const getVendorById = (vendorId: string) => {
  const vendor = get<{
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
    handler: ({ res, auth, url }) => {
      const { marketId } = resolveScopedMarket(auth, "vendor:read", url.searchParams.get("marketId"));
      const params = marketId ? [marketId] : [];
      const vendors = all<{
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
    handler: ({ res, auth, params }) => {
      const session = requireAuth(auth);
      const vendor = getVendorById(params.id);
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
    method: "POST",
    path: "/vendors/:id/approve",
    handler: async ({ req, res, auth, params }) => {
      const session = requirePermission(auth, "vendor:review");
      const vendor = getVendorById(params.id);
      if (!vendor) {
        throw new HttpError(404, "Vendor not found.");
      }
      assertMarketAccess(session, vendor.marketId);

      const timestamp = nowIso();
      run(
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

      queueNotification({
        userId: params.id,
        type: "system",
        message: "Your vendor profile has been approved. You can now sign in and reserve stalls.",
        channels: ["system", "sms"],
        destinationPhone: vendor.phone,
      });

      logAuditEvent({
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
      sendJson(res, 200, { vendor: getVendorById(params.id) });
    },
  },
  {
    method: "POST",
    path: "/vendors/:id/reject",
    handler: async ({ req, res, auth, params }) => {
      const session = requirePermission(auth, "vendor:review");
      const vendor = getVendorById(params.id);
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
      run(
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

      queueNotification({
        userId: params.id,
        type: "system",
        message: `Your vendor profile was rejected: ${reason}`,
        channels: ["system", "sms"],
        destinationPhone: vendor.phone,
      });

      logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: vendor.marketId,
        action: "REJECT_VENDOR",
        entityType: "vendor",
        entityId: params.id,
        details: { vendorName: vendor.name, reason },
      });

      sendJson(res, 200, { vendor: getVendorById(params.id) });
    },
  },
];
