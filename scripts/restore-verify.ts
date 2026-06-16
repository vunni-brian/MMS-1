import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DATABASE_URL = process.env.DATABASE_URL || "";
const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";

const parseDatabaseUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      database: parsed.pathname.slice(1),
      username: parsed.username,
      password: parsed.password,
    };
  } catch {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }
};

const getLatestBackup = (): string | null => {
  if (!existsSync(BACKUP_DIR)) {
    console.error(`Backup directory not found: ${BACKUP_DIR}`);
    return null;
  }

  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".sql") || f.endsWith(".sql.gz"))
    .filter((f) => !f.endsWith(".metadata.json"))
    .sort()
    .reverse();

  return files.length > 0 ? files[0] : null;
};

const verifyBackup = (filepath: string): boolean => {
  if (!existsSync(filepath)) {
    console.error(`Backup file not found: ${filepath}`);
    return false;
  }

  const stats = statSync(filepath);
  if (stats.size === 0) {
    console.error("Backup file is empty");
    return false;
  }

  console.log(`Backup file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  try {
    if (filepath.endsWith(".gz")) {
      execSync(`gunzip -t "${filepath}"`, { stdio: "pipe" });
      console.log("GZip integrity check passed");
    } else {
      const header = execSync(`head -n 5 "${filepath}"`, { encoding: "utf-8", stdio: "pipe" });
      if (!header.includes("PostgreSQL") && !header.includes("pg_dump") && !header.includes("CREATE")) {
        console.warn("Warning: File may not be a valid PostgreSQL dump");
      }
    }
    return true;
  } catch (error) {
    console.error("Backup verification failed:", error instanceof Error ? error.message : String(error));
    return false;
  }
};

const restore = (backupFile: string) => {
  const dbConfig = parseDatabaseUrl(DATABASE_URL);
  const filepath = join(BACKUP_DIR, backupFile);

  if (!verifyBackup(filepath)) {
    process.exit(1);
  }

  console.log(`Restoring from ${backupFile}...`);
  console.log(`Target database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);

  try {
    const env = { ...process.env, PGPASSWORD: dbConfig.password };

    if (backupFile.endsWith(".gz")) {
      execSync(`gunzip -c "${filepath}" | psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database}`, {
        stdio: "inherit",
        env,
      });
    } else {
      execSync(`psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${filepath}"`, {
        stdio: "inherit",
        env,
      });
    }

    console.log("Restore completed successfully");
  } catch (error) {
    console.error("Restore failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

const verifyRestore = () => {
  console.log("Verifying database integrity after restore...");

  try {
    const env = { ...process.env };
    const dbConfig = parseDatabaseUrl(DATABASE_URL);
    Object.assign(env, { PGPASSWORD: dbConfig.password });

    const tables = execSync(
      `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`,
      { encoding: "utf-8", env },
    ).trim();

    const schemaCount = execSync(
      `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -t -c "SELECT COUNT(*) FROM schema_migrations;"`,
      { encoding: "utf-8", env },
    ).trim();

    console.log(`Tables restored: ${tables}`);
    console.log(`Migrations applied: ${schemaCount}`);

    const hasData = execSync(
      `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -t -c "SELECT COUNT(*) FROM users;"`,
      { encoding: "utf-8", env },
    ).trim();

    console.log(`Users in database: ${hasData}`);

    if (Number(tables) > 0 && Number(schemaCount) > 0) {
      console.log("Restore verification: PASSED");
    } else {
      console.error("Restore verification: FAILED - Missing tables or migrations");
      process.exit(1);
    }
  } catch (error) {
    console.error("Restore verification failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

const command = process.argv[2];
const backupFile = process.argv[3];

switch (command) {
  case "restore":
    if (!backupFile) {
      const latest = getLatestBackup();
      if (!latest) {
        console.error("No backup files found. Specify a backup file or create one first.");
        process.exit(1);
      }
      console.log(`Using latest backup: ${latest}`);
      restore(latest);
    } else {
      restore(backupFile);
    }
    break;
  case "verify":
    verifyRestore();
    break;
  case "list": {
    const dbConfig = parseDatabaseUrl(DATABASE_URL);
    const env = { ...process.env, PGPASSWORD: dbConfig.password };
    try {
      execSync(
        `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -c "SELECT table_name, (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS columns FROM information_schema.tables t WHERE table_schema = 'public' ORDER BY table_name;"`,
        { stdio: "inherit", env },
      );
    } catch (error) {
      console.error("Failed to list database tables:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    break;
  }
  default:
    console.log("Usage:");
    console.log("  node --experimental-strip-types scripts/restore-verify.ts restore [file]  - Restore from backup");
    console.log("  node --experimental-strip-types scripts/restore-verify.ts verify          - Verify database integrity");
    console.log("  node --experimental-strip-types scripts/restore-verify.ts list            - List database tables");
    process.exit(1);
}
