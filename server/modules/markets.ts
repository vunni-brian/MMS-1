import { listMarkets } from "../lib/db.ts";
import { sendJson, type RouteDefinition } from "../lib/http.ts";

export const marketRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/markets",
    handler: async ({ res }) => {
      sendJson(res, 200, { markets: await listMarkets() });
    },
  },
];
