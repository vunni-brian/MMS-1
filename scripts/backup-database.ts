import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createId } from "../server/lib/db.ts";
import { nowIso } from "../server/lib/security.ts";

interface BackupConfig {
  databaseUrl: string;
  backupDir: string;
  retentionDays: number;
  compress: boolean;
}

const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  databaseUrl: process.env.DATABASE_URL || "",
  backupDir: process.env.BACKUP_DIR || "./backups",
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10),
  compress: process.env.BACKUP_COMPRESS !== "false",
};

class DatabaseBackup {
  private config: BackupConfig;

  constructor(config: BackupConfig = DEFAULT_BACKUP_CONFIG) {
    this.config = config;
    this.ensureBackupDir();
  }

  private ensureBackupDir() {
    if (!existsSync(this.config.backupDir)) {
      mkdirSync(this.config.backupDir, { recursive: true });
    }
  }

  private getBackupFilename(): string {
    const timestamp = nowIso().replace(/[:.]/g, "-");
    const backupId = createId("backup");
    const extension = this.config.compress ? ".sql.gz" : ".sql";
    return `mms-backup-${timestamp}-${backupId}${extension}`;
  }

  private parseDatabaseUrl(): { host: string; port: string; database: string; username: string } {
    try {
      const url = new URL(this.config.databaseUrl);
      return {
        host: url.hostname,
        port: url.port || "5432",
        database: url.pathname.slice(1),
        username: url.username,
      };
    } catch (error) {
      throw new Error(`Invalid DATABASE_URL: ${error}`);
    }
  }

  async createBackup(): Promise<string> {
    const { host, port, database, username } = this.parseDatabaseUrl();
    const filename = this.getBackupFilename();
    const filepath = join(this.config.backupDir, filename);

    console.log(`Starting database backup to ${filepath}...`);

    try {
      let command: string;

      if (this.config.compress) {
        command = `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --clean --if-exists | gzip > ${filepath}`;
      } else {
        command = `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --clean --if-exists > ${filepath}`;
      }

      execSync(command, { stdio: "inherit" });

      console.log(`Backup completed successfully: ${filepath}`);
      
      // Create backup metadata
      const metadata = {
        filename,
        filepath,
        createdAt: nowIso(),
        size: this.getFileSize(filepath),
        database,
        compressed: this.config.compress,
      };

      const metadataPath = join(this.config.backupDir, `${filename}.metadata.json`);
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      return filepath;
    } catch (error) {
      throw new Error(`Backup failed: ${error}`);
    }
  }

  private getFileSize(filepath: string): number {
    const stats = statSync(filepath);
    return stats.size;
  }

  async restoreBackup(backupFile: string): Promise<void> {
    const { host, port, database, username } = this.parseDatabaseUrl();
    const filepath = join(this.config.backupDir, backupFile);

    if (!existsSync(filepath)) {
      throw new Error(`Backup file not found: ${filepath}`);
    }

    console.log(`Starting database restore from ${filepath}...`);

    try {
      let command: string;

      if (backupFile.endsWith(".gz")) {
        command = `gunzip -c ${filepath} | PGPASSWORD="${process.env.DB_PASSWORD}" psql -h ${host} -p ${port} -U ${username} -d ${database}`;
      } else {
        command = `PGPASSWORD="${process.env.DB_PASSWORD}" psql -h ${host} -p ${port} -U ${username} -d ${database} < ${filepath}`;
      }

      execSync(command, { stdio: "inherit" });

      console.log(`Restore completed successfully from: ${filepath}`);
    } catch (error) {
      throw new Error(`Restore failed: ${error}`);
    }
  }

  async listBackups(): Promise<Array<{ filename: string; createdAt: string; size: number }>> {
    const files = readdirSync(this.config.backupDir);
    const backups: Array<{ filename: string; createdAt: string; size: number }> = [];

    for (const file of files) {
      if (file.endsWith(".metadata.json")) continue;
      if (!file.endsWith(".sql") && !file.endsWith(".sql.gz")) continue;

      const filepath = join(this.config.backupDir, file);
      const metadataPath = `${filepath}.metadata.json`;

      let createdAt = nowIso();
      const size = this.getFileSize(filepath);

      if (existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
          createdAt = metadata.createdAt || createdAt;
        } catch {
          // Use file stats if metadata is invalid
        }
      }

      backups.push({ filename: file, createdAt, size });
    }

    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async cleanupOldBackups(): Promise<number> {
    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    let deleted = 0;

    for (const backup of backups) {
      const backupDate = new Date(backup.createdAt);
      if (backupDate < cutoffDate) {
        const filepath = join(this.config.backupDir, backup.filename);
        const metadataPath = `${filepath}.metadata.json`;

        unlinkSync(filepath);
        if (existsSync(metadataPath)) {
          unlinkSync(metadataPath);
        }

        console.log(`Deleted old backup: ${backup.filename}`);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} old backups`);
    }

    return deleted;
  }

  async verifyBackup(backupFile: string): Promise<boolean> {
    const filepath = join(this.config.backupDir, backupFile);

    if (!existsSync(filepath)) {
      throw new Error(`Backup file not found: ${filepath}`);
    }

    try {
      let command: string;

      if (backupFile.endsWith(".gz")) {
        command = `gunzip -t ${filepath}`;
      } else {
        command = `head -n 1 ${filepath}`;
      }

      execSync(command, { stdio: "pipe" });
      return true;
    } catch (error) {
      console.error(`Backup verification failed: ${error}`);
      return false;
    }
  }
}

// CLI interface
const command = process.argv[2];
const backup = new DatabaseBackup();

async function main() {
  switch (command) {
    case "create":
      await backup.createBackup();
      break;
    case "restore":
      if (!process.argv[3]) {
        console.error("Please specify backup file to restore");
        process.exit(1);
      }
      await backup.restoreBackup(process.argv[3]);
      break;
    case "list": {
      const backups = await backup.listBackups();
      console.table(backups);
      break;
    }
    case "cleanup":
      await backup.cleanupOldBackups();
      break;
    case "verify": {
      if (!process.argv[3]) {
        console.error("Please specify backup file to verify");
        process.exit(1);
      }
      const isValid = await backup.verifyBackup(process.argv[3]);
      console.log(`Backup is ${isValid ? "valid" : "invalid"}`);
      break;
    }
    default:
      console.log("Usage:");
      console.log("  node backup-database.ts create     - Create a new backup");
      console.log("  node backup-database.ts restore    <file> - Restore from backup");
      console.log("  node backup-database.ts list       - List all backups");
      console.log("  node backup-database.ts cleanup    - Clean up old backups");
      console.log("  node backup-database.ts verify     <file> - Verify backup integrity");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
