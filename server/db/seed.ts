import { closeDatabase, initDatabase, seedDatabase } from "../lib/db.ts";

await initDatabase();
await seedDatabase();
await closeDatabase();

console.log("Database seed completed.");
