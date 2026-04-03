import { closeDatabase, initDatabase } from "../lib/db.ts";

await initDatabase();
await closeDatabase();
console.log("PostgreSQL migrations are up to date.");
