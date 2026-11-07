import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { connectMongo } from "../src/config/db";
import { createSqlClient } from "../src/repositories/sql";
import { exportSql, sourceColumns } from "../src/repositories/migration/export";
import { importSnapshot, reconcile, restoreSnapshot } from "../src/repositories/migration/import";
import type { MigrationExport } from "../src/repositories/migration/manifest";
import { canonical } from "../src/repositories/migration/transform";

const [command, path] = process.argv.slice(2);
if (!path || !["export", "import", "reconcile", "restore-export"].includes(command ?? "")) throw new Error("Usage: migrate-mongo.ts export|import|reconcile|restore-export <private-snapshot-file>");
const schema = await readFile(fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url)), "utf8");
if (command === "export") {
  if (!process.env.MIGRATION_SOURCE_SQL_URL) throw new Error("MIGRATION_SOURCE_SQL_URL is required");
  const db = createSqlClient("postgres", process.env.MIGRATION_SOURCE_SQL_URL);
  try { const source = await exportSql(db, schema); await writeFile(path, JSON.stringify(source), { mode: 0o600, flag: "wx" }); console.log("Read-only SQL snapshot exported"); }
  finally { await db.end(); }
} else {
  if (!process.env.MIGRATION_TARGET_MONGO_URI) throw new Error("MIGRATION_TARGET_MONGO_URI is required; use a fresh offline database");
  const db = await connectMongo(process.env.MIGRATION_TARGET_MONGO_URI);
  try {
    if (command === "restore-export") {
      await writeFile(path, JSON.stringify(await restoreSnapshot(db)), { mode: 0o600, flag: "wx" });
      console.log("Archived source snapshot restored to file");
    } else {
      const source = JSON.parse(await readFile(path, "utf8")) as MigrationExport;
      if (source.schemaSha256 !== createHash("sha256").update(schema).digest("hex") || canonical(source.columns) !== canonical(sourceColumns(schema))) throw new Error("Snapshot SQL schema does not match committed schema");
      const report = command === "import" ? await importSnapshot(source, db) : await reconcile(source, db);
      console.log(JSON.stringify(report));
    }
  } finally { await db.close(); }
}
