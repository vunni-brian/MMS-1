import { listMarketManagers, listMarkets } from "../lib/db.ts";
import { HttpError, sendJson, type RouteDefinition } from "../lib/http.ts";
import { assertMarketAccess, requireAuth } from "../lib/session.ts";

export const marketRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/markets",
    handler: async ({ res }) => {
      sendJson(res, 200, { markets: await listMarkets() });
    },
  },
  {
    method: "GET",
    path: "/markets/:id/managers",
    handler: async ({ res, auth, params }) => {
      const session = requireAuth(auth);
      const market = (await listMarkets()).find((item) => item.id === params.id);
      if (!market) {
        throw new HttpError(404, "Market not found.");
      }
      assertMarketAccess(session, params.id);
      sendJson(res, 200, { managers: await listMarketManagers(params.id) });
    },
  },
];
