import fs from "node:fs";

import { all, get, getManagerForMarket, getUserRecordById, logAuditEvent, queueNotification, run, transaction } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { getNotificationPriority } from "../lib/notification-priority.ts";
import { applyUserPassword, buildVendorPasswordResetMessage, revokeUserSessions } from "../lib/passwords.ts";
import { assertMarketAccess, requireAuth, requirePermission, resolveScopedMarket } from "../lib/session.ts";
import { createTemporaryPassword, normalizePhoneNumber, nowIso } from "../lib/security.ts";
import { downloadSupabaseStorageObject, findSupabaseAuthUser, updateSupabaseAuthUser } from "../lib/supabase.ts";
import type { Role, VendorActivityEvent } from "../types.ts";

const vendorSelect = `
  SELECT users.id,
         users.name,
         users.email,
         users.phone,
         users.created_at,
         users.market_id,
         users.profile_image_name,
         users.profile_image_path,
         users.profile_image_mime_type,
         users.profile_image_size,
         markets.name AS market_name,
         markets.location AS market_location,
         vendor_profiles.approval_status,
         vendor_profiles.approval_reason,
         vendor_profiles.national_id_number,
         vendor_profiles.district,
         vendor_profiles.product_section,
         vendor_profiles.id_document_name,
         vendor_profiles.id_document_path,
         vendor_profiles.id_document_mime_type,
         vendor_profiles.id_document_size,
         vendor_profiles.lc_letter_name,
         vendor_profiles.lc_letter_path,
         vendor_profiles.lc_letter_mime_type,
         vendor_profiles.lc_letter_size
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
  profile_image_name: string | null;
  profile_image_path: string | null;
  profile_image_mime_type: string | null;
  profile_image_size: number | null;
  market_name: string | null;
  market_location: string | null;
  approval_status: string;
  approval_reason: string | null;
  national_id_number: string | null;
  district: string | null;
  product_section: string | null;
  id_document_name: string | null;
  id_document_path: string | null;
  id_document_mime_type: string | null;
  id_document_size: number | null;
  lc_letter_name: string | null;
  lc_letter_path: string | null;
  lc_letter_mime_type: string | null;
  lc_letter_size: number | null;
}) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  createdAt: row.created_at,
  marketId: row.market_id,
  marketName: row.market_name,
  nationalIdNumber: row.national_id_number,
  district: row.district,
  productSection: row.product_section,
  status: row.approval_status,
  approvalReason: row.approval_reason,
  profileImage: row.profile_image_name
    ? {
        id: `${row.id}:profile-image`,
        name: row.profile_image_name,
        storagePath: row.profile_image_path,
        mimeType: row.profile_image_mime_type,
        size: row.profile_image_size,
        createdAt: row.created_at,
      }
    : null,
  idDocument: row.id_document_name
    ? {
        id: `${row.id}:national-id`,
        name: row.id_document_name,
        storagePath: row.id_document_path,
        mimeType: row.id_document_mime_type,
        size: row.id_document_size,
      }
    : null,
  lcLetter: row.lc_letter_name
    ? {
        id: `${row.id}:lc-letter`,
        name: row.lc_letter_name,
        storagePath: row.lc_letter_path,
        mimeType: row.lc_letter_mime_type,
        size: row.lc_letter_size,
      }
    : null,
  documentValidation: {
    nationalIdPresent: Boolean(row.id_document_name),
    lcLetterPresent: Boolean(row.lc_letter_name),
  },
});

const getVendorById = async (vendorId: string) => {
  const vendor = await get<{
    id: string;
    name: string;
    email: string;
    phone: string;
    created_at: string;
    market_id: string | null;
    profile_image_name: string | null;
    profile_image_path: string | null;
    profile_image_mime_type: string | null;
    profile_image_size: number | null;
    market_name: string | null;
    market_location: string | null;
    approval_status: string;
    approval_reason: string | null;
    national_id_number: string | null;
    district: string | null;
    product_section: string | null;
    id_document_name: string | null;
    id_document_path: string | null;
    id_document_mime_type: string | null;
    id_document_size: number | null;
    lc_letter_name: string | null;
    lc_letter_path: string | null;
    lc_letter_mime_type: string | null;
    lc_letter_size: number | null;
  }>(`${vendorSelect} WHERE users.id = ?`, [vendorId]);

  return vendor ? mapVendor(vendor) : null;
};

const auditActionLabels: Record<string, string> = {
  APPROVE_VENDOR: "Vendor approved",
  REJECT_VENDOR: "Vendor rejected",
  RESET_VENDOR_PASSWORD: "Vendor password reset",
  TRANSFER_VENDOR_MARKET: "Market transfer requested",
  UPDATE_VENDOR_PROFILE: "Vendor profile updated",
  UPDATE_OWN_PROFILE: "Account profile updated",
  LOGIN_SUCCESS: "Login successful",
  LOGIN_FAILED: "Login failed",
  LOGIN_BLOCKED_REJECTED_VENDOR: "Login blocked",
  CREATE_TICKET: "Complaint created",
  UPDATE_TICKET: "Complaint updated",
  APPROVE_BOOKING: "Stall allocation approved",
  REJECT_BOOKING: "Stall allocation rejected",
  MARK_BOOKING_PAID: "Stall allocation paid",
  CONFIRM_BOOKING: "Stall allocation confirmed",
  CREATE_PAYMENT: "Payment initiated",
  COMPLETE_PAYMENT: "Payment completed",
};

const formatActionTitle = (action: string) =>
  auditActionLabels[action] ||
  action
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatStatusLabel = (status: string | null) =>
  status
    ? status
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : null;

const parseDetailsJson = (value: string | null): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw: value };
  }
};

const normalizePriority = (statusOrAction: string | null): VendorActivityEvent["priority"] => {
  const value = (statusOrAction || "").toLowerCase();
  if (
    value.includes("reject") ||
    value.includes("failed") ||
    value.includes("blocked") ||
    value.includes("overdue") ||
    value.includes("penalty") ||
    value.includes("suspended")
  ) {
    return "high";
  }
  if (value.includes("pending") || value.includes("open") || value.includes("in_progress") || value.includes("approval")) {
    return "normal";
  }
  return "low";
};

const normalizeRole = (role: string | null): Role | null =>
  role === "vendor" || role === "manager" || role === "official" || role === "admin" ? role : null;

const loadVendorActivity = async (vendorId: string): Promise<VendorActivityEvent[]> => {
  const [auditRows, bookingRows, ticketRows, ticketUpdateRows, paymentRows, notificationRows] = await Promise.all([
    all<{
      id: string;
      actor_name: string;
      actor_role: string;
      action: string;
      entity_type: string;
      entity_id: string;
      details_json: string | null;
      created_at: string;
    }>(
      `SELECT id, actor_name, actor_role, action, entity_type, entity_id, details_json, created_at
       FROM audit_events
       WHERE (entity_type = 'vendor' AND entity_id = ?)
          OR (entity_type = 'user' AND entity_id = ?)
          OR (actor_user_id = ? AND action LIKE 'LOGIN_%')
          OR (entity_type = 'ticket' AND entity_id IN (SELECT id FROM tickets WHERE vendor_id = ?))
          OR (entity_type = 'booking' AND entity_id IN (SELECT id FROM bookings WHERE vendor_id = ?))
          OR (entity_type = 'payment' AND entity_id IN (SELECT id FROM payments WHERE vendor_id = ?))
       ORDER BY created_at DESC
       LIMIT 80`,
      [vendorId, vendorId, vendorId, vendorId, vendorId, vendorId],
    ),
    all<{
      id: string;
      status: string;
      start_date: string;
      end_date: string;
      amount: number;
      created_at: string;
      reviewed_at: string | null;
      reviewed_by_name: string | null;
      stall_name: string;
      stall_zone: string;
    }>(
      `SELECT bookings.id,
              bookings.status,
              bookings.start_date,
              bookings.end_date,
              bookings.amount,
              bookings.created_at,
              bookings.reviewed_at,
              reviewers.name AS reviewed_by_name,
              stalls.name AS stall_name,
              stalls.zone AS stall_zone
       FROM bookings
       INNER JOIN stalls ON stalls.id = bookings.stall_id
       LEFT JOIN users AS reviewers ON reviewers.id = bookings.reviewed_by_user_id
       WHERE bookings.vendor_id = ?
       ORDER BY bookings.created_at DESC
       LIMIT 40`,
      [vendorId],
    ),
    all<{
      id: string;
      category: string;
      subject: string;
      status: string;
      resolution_note: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, category, subject, status, resolution_note, created_at, updated_at
       FROM tickets
       WHERE vendor_id = ?
       ORDER BY updated_at DESC
       LIMIT 40`,
      [vendorId],
    ),
    all<{
      id: string;
      status: string;
      note: string;
      created_at: string;
      actor_name: string;
      actor_role: string;
      subject: string;
    }>(
      `SELECT ticket_updates.id,
              ticket_updates.status,
              ticket_updates.note,
              ticket_updates.created_at,
              users.name AS actor_name,
              users.role AS actor_role,
              tickets.subject
       FROM ticket_updates
       INNER JOIN tickets ON tickets.id = ticket_updates.ticket_id
       INNER JOIN users ON users.id = ticket_updates.actor_user_id
       WHERE tickets.vendor_id = ?
       ORDER BY ticket_updates.created_at DESC
       LIMIT 60`,
      [vendorId],
    ),
    all<{
      id: string;
      charge_type: string | null;
      amount: number;
      status: string;
      transaction_id: string | null;
      receipt_id: string | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(
      `SELECT id, charge_type, amount, status, transaction_id, receipt_id, created_at, updated_at, completed_at
       FROM payments
       WHERE vendor_id = ?
       ORDER BY created_at DESC
       LIMIT 40`,
      [vendorId],
    ),
    all<{
      id: string;
      type: string;
      message: string;
      read_at: string | null;
      created_at: string;
    }>(
      `SELECT id, type, message, read_at, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 40`,
      [vendorId],
    ),
  ]);

  const events: VendorActivityEvent[] = [];

  for (const row of auditRows) {
    const title = formatActionTitle(row.action);
    const details = parseDetailsJson(row.details_json);
    events.push({
      id: `audit:${row.id}`,
      type: "audit",
      title,
      description: `${row.actor_name} recorded ${title.toLowerCase()}.`,
      actorName: row.actor_name,
      actorRole: normalizeRole(row.actor_role),
      status: row.action,
      priority: normalizePriority(row.action),
      metadata: details ? { ...details, entityType: row.entity_type, entityId: row.entity_id } : { entityType: row.entity_type, entityId: row.entity_id },
      createdAt: row.created_at,
    });
  }

  for (const row of bookingRows) {
    const status = formatStatusLabel(row.status) || row.status;
    events.push({
      id: `booking:${row.id}`,
      type: "booking",
      title: `Stall allocation ${status.toLowerCase()}`,
      description: `${row.stall_name} in ${row.stall_zone} is ${status.toLowerCase()} for this vendor.`,
      actorName: row.reviewed_by_name,
      actorRole: row.reviewed_by_name ? "manager" : null,
      status: row.status,
      priority: normalizePriority(row.status),
      metadata: {
        amount: row.amount,
        startDate: row.start_date,
        endDate: row.end_date,
        reviewedAt: row.reviewed_at,
      },
      createdAt: row.reviewed_at || row.created_at,
    });
  }

  for (const row of ticketRows) {
    const status = formatStatusLabel(row.status) || row.status;
    events.push({
      id: `ticket:${row.id}`,
      type: "ticket",
      title: `Complaint ${status.toLowerCase()}`,
      description: `${row.subject} is ${status.toLowerCase()}.`,
      actorName: null,
      actorRole: null,
      status: row.status,
      priority: normalizePriority(row.status),
      metadata: {
        category: row.category,
        resolutionNote: row.resolution_note,
      },
      createdAt: row.updated_at || row.created_at,
    });
  }

  for (const row of ticketUpdateRows) {
    const status = formatStatusLabel(row.status) || row.status;
    events.push({
      id: `ticket-update:${row.id}`,
      type: "ticket_update",
      title: `Complaint moved to ${status}`,
      description: `${row.subject}: ${row.note}`,
      actorName: row.actor_name,
      actorRole: normalizeRole(row.actor_role),
      status: row.status,
      priority: normalizePriority(row.status),
      metadata: null,
      createdAt: row.created_at,
    });
  }

  for (const row of paymentRows) {
    const status = formatStatusLabel(row.status) || row.status;
    const chargeType = formatStatusLabel(row.charge_type || "payment") || "Payment";
    events.push({
      id: `payment:${row.id}`,
      type: "payment",
      title: `${chargeType} payment ${status.toLowerCase()}`,
      description: `${chargeType} payment of UGX ${Number(row.amount || 0).toLocaleString("en-US")} is ${status.toLowerCase()}.`,
      actorName: null,
      actorRole: null,
      status: row.status,
      priority: normalizePriority(row.status),
      metadata: {
        transactionId: row.transaction_id,
        receiptId: row.receipt_id,
      },
      createdAt: row.completed_at || row.updated_at || row.created_at,
    });
  }

  for (const row of notificationRows) {
    events.push({
      id: `notification:${row.id}`,
      type: "notification",
      title: `${formatStatusLabel(row.type) || "System"} notification`,
      description: row.message,
      actorName: null,
      actorRole: null,
      status: row.read_at ? "read" : "unread",
      priority: getNotificationPriority(row.type, row.message),
      metadata: {
        notificationType: row.type,
        readAt: row.read_at,
      },
      createdAt: row.created_at,
    });
  }

  return events
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 120);
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
        profile_image_name: string | null;
        profile_image_path: string | null;
        profile_image_mime_type: string | null;
        profile_image_size: number | null;
        market_name: string | null;
        market_location: string | null;
        approval_status: string;
        approval_reason: string | null;
        national_id_number: string | null;
        district: string | null;
        product_section: string | null;
        id_document_name: string | null;
        id_document_path: string | null;
        id_document_mime_type: string | null;
        id_document_size: number | null;
        lc_letter_name: string | null;
        lc_letter_path: string | null;
        lc_letter_mime_type: string | null;
        lc_letter_size: number | null;
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
    method: "GET",
    path: "/vendors/:id/activity",
    handler: async ({ res, auth, params }) => {
      const session = requireAuth(auth);
      const vendor = await getVendorById(params.id);
      if (!vendor) {
        throw new HttpError(404, "Vendor not found.");
      }
      if (session.user.role === "vendor" && session.user.id !== params.id) {
        throw new HttpError(403, "You may only view your own vendor activity.");
      }
      assertMarketAccess(session, vendor.marketId);

      sendJson(res, 200, { events: await loadVendorActivity(params.id) });
    },
  },
  {
    method: "GET",
    path: "/vendors/:id/documents/:type",
    handler: async ({ res, auth, params }) => {
      const session = requireAuth(auth);
      const vendor = await getVendorById(params.id);
      if (!vendor) {
        throw new HttpError(404, "Vendor not found.");
      }
      if (session.user.role === "vendor" && session.user.id !== params.id) {
        throw new HttpError(403, "You may only view your own vendor documents.");
      }
      assertMarketAccess(session, vendor.marketId);

      const attachment =
        params.type === "national-id" ? vendor.idDocument : params.type === "lc-letter" ? vendor.lcLetter : null;
      if (!attachment?.storagePath) {
        throw new HttpError(404, "Document not found.");
      }

      res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.name)}"`);
      res.setHeader("Cache-Control", "private, max-age=60");

      if (attachment.storagePath.startsWith("supabase://")) {
        const buffer = await downloadSupabaseStorageObject(attachment.storagePath);
        if (!buffer) {
          throw new HttpError(404, "Document not found.");
        }
        res.writeHead(200);
        res.end(buffer);
        return;
      }

      if (!fs.existsSync(attachment.storagePath)) {
        throw new HttpError(404, "Document file is missing from storage.");
      }

      res.writeHead(200);
      fs.createReadStream(attachment.storagePath).pipe(res);
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
        productSection?: string | null;
      }>(req);

      const name = body.name?.trim() || vendor.name;
      const email = body.email?.trim().toLowerCase() || vendor.email;
      const phone = body.phone ? normalizePhoneNumber(body.phone) : vendor.phone;
      const marketId = body.marketId?.trim() || vendor.marketId;
      const productSection = body.productSection?.trim() || vendor.productSection || null;

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
             SET product_section = ?,
                 approval_status = 'pending',
                 approval_reason = NULL,
                 approved_by = NULL,
                 approved_at = NULL,
                 rejected_by = NULL,
                 rejected_at = NULL
             WHERE user_id = ?`,
            [productSection, params.id],
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
        } else {
          await run(
            `UPDATE vendor_profiles
             SET product_section = ?
             WHERE user_id = ?`,
            [productSection, params.id],
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
          productSection,
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
    path: "/vendors/:id/reset-password",
    handler: async ({ req, res, auth, params, config }) => {
      const session = requirePermission(auth, "vendor:review");
      const vendor = await getUserRecordById(params.id);
      if (!vendor || vendor.role !== "vendor") {
        throw new HttpError(404, "Vendor not found.");
      }
      assertMarketAccess(session, vendor.market_id);

      const body = await readJsonBody<{ reason?: string }>(req);
      const reason = body.reason?.trim();
      if (!reason) {
        throw new HttpError(400, "A reset reason is required.");
      }
      if (!vendor.phone_verified_at) {
        throw new HttpError(409, "Password reset is only available after the vendor verifies their phone number.");
      }
      if (session.user.role === "manager" && vendor.vendor_status !== "approved") {
        throw new HttpError(409, "Managers can only reset passwords for approved vendors.");
      }

      const temporaryPassword = createTemporaryPassword();
      await applyUserPassword(vendor, temporaryPassword);
      await revokeUserSessions({ userId: vendor.id });

      await queueNotification({
        userId: vendor.id,
        type: "system",
        message: buildVendorPasswordResetMessage({
          temporaryPassword,
          reason,
          appUrl: config.appUrl,
        }),
        channels: ["system", "sms"],
        destinationPhone: vendor.phone,
      });

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: vendor.market_id,
        action: "RESET_VENDOR_PASSWORD",
        entityType: "vendor",
        entityId: vendor.id,
        details: {
          vendorName: vendor.name,
          reason,
          vendorStatus: vendor.vendor_status,
        },
      });

      sendJson(res, 200, {
        message: `A temporary password was sent to ${vendor.phone}.`,
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
      if (!vendor.idDocument || !vendor.lcLetter || !vendor.nationalIdNumber || !vendor.district) {
        throw new HttpError(409, "National ID, NIN, district, and LC Letter are required before approval.");
      }

      const body = await readJsonBody<{ notes?: string }>(req);
      const notes = body.notes?.trim() || null;

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
        details: { vendorName: vendor.name, notes },
      });

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
