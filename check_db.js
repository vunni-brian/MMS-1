import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('runtime/mms.sqlite');
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();

console.log('Tables in database:');
for (const t of tables) {
  const c = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get().count;
  console.log(`- ${t.name} (${c} rows)`);
}
