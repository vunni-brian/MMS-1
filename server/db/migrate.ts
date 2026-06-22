/**
 * @file Standalone migration entry point.
 * Applies all pending SQL migrations and exits.
 * Used via `deno task migrate` or `npm run migrate`.
 */

import { closeDatabase, initDatabase } from "../lib/db.ts";

await initDatabase();
await closeDatabase();
console.log("PostgreSQL migrations are up to date.");
