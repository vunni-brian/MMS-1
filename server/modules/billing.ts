import { getChargeTypeById, listChargeTypes, updateChargeType } from "../lib/billing.ts";
import { logAuditEvent } from "../lib/db.ts";
import { HttpError, readJsonBody, sendJson, type RouteDefinition } from "../lib/http.ts";
import { requirePermission, resolveScopedMarket } from "../lib/session.ts";

export const billingRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/billing/charge-types",
    handler: async ({ res, auth, url }) => {
      const { marketId } = resolveScopedMarket(auth, "billing:read", url.searchParams.get("marketId"));
      sendJson(res, 200, { chargeTypes: await listChargeTypes(marketId) });
    },
  },
  {
    method: "PATCH",
    path: "/billing/charge-types/:id",
    handler: async ({ req, res, auth, params }) => {
      const session = requirePermission(auth, "billing:manage");
      const current = await getChargeTypeById(params.id);
      if (!current) {
        throw new HttpError(404, "Charge type not found.");
      }

      const body = await readJsonBody<{ isEnabled?: boolean }>(req);
      if (typeof body.isEnabled !== "boolean") {
        throw new HttpError(400, "An isEnabled boolean value is required.");
      }

      const updated = await updateChargeType({
        chargeTypeId: current.id,
        isEnabled: body.isEnabled,
        actorUserId: session.user.id,
      });
      if (!updated) {
        throw new HttpError(500, "Unable to update charge type.");
      }

      await logAuditEvent({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorRole: session.user.role,
        marketId: updated.marketId,
        action: "UPDATE_CHARGE_TYPE",
        entityType: "charge_type",
        entityId: updated.id,
        details: {
          name: updated.name,
          scope: updated.scope,
          isEnabled: updated.isEnabled,
        },
      });

      sendJson(res, 200, { chargeType: updated });
    },
  },
];
