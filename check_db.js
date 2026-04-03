import pg from "pg";

const { Client } = pg;

const databaseUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/mms";
const databaseSsl =
  process.env.DATABASE_SSL === "true" ||
  (!process.env.DATABASE_SSL && /supabase\.(co|com)|sslmode=require/i.test(databaseUrl));
const client = new Client({
  connectionString: databaseUrl,
  ssl: databaseSsl && !databaseUrl.includes("sslmode=disable") ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

const tables = await client.query(`
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename ASC
`);

console.log("Tables in database:");
for (const table of tables.rows) {
  const result = await client.query(`SELECT COUNT(*)::INT AS count FROM "${table.tablename}"`);
  console.log(`- ${table.tablename} (${result.rows[0].count} rows)`);
}

await client.end();
