/**
 * @file Standalone seed entry point.
 * Populates the database with demo / development seed data and exits.
 * Used via `deno task seed` or `npm run seed`.
 */

import { closeDatabase, initDatabase, seedDatabase } from "../lib/db.ts";

await initDatabase();
await seedDatabase();
await closeDatabase();

console.log("Database seed completed.");
