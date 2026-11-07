import { createHash } from "node:crypto";
import type { SqlClient } from "../sql";
import { tables, type MigrationExport, type SourceColumn, type SourceTable } from "./manifest";

export function sourceColumns(schema: string): Record<SourceTable, SourceColumn[]> {
  const result: Record<string, SourceColumn[]> = {};
  for (const match of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    result[match[1]!] = [...match[2]!.matchAll(/^\s+(\w+)\s+(String|Int|BigInt|Float|Decimal|Boolean|DateTime|Json)(\??)(?:\s|$)/gm)].map(field => ({ name: field[1]!, type: field[2]!, nullable: field[3] === "?" }));
  }
  if (JSON.stringify(Object.keys(result).sort()) !== JSON.stringify(Object.keys(tables).sort())) throw new Error("Committed SQL schema coverage changed; update migration manifest");
  return result as Record<SourceTable, SourceColumn[]>;
}
/** Read-only repeatable snapshot on one PostgreSQL connection. */
export async function exportSql(db: SqlClient, schema: string): Promise<MigrationExport> {
  if (db.provider !== "postgres") throw new Error("M4 exporter currently supports PostgreSQL only");
  const columns = sourceColumns(schema);
  const client = await db.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const catalog = await client.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    const expected = new Set<string>([...Object.keys(tables), "_prisma_migrations"]);
    if (catalog.rows.some(row => !expected.has(row.table_name)) || Object.keys(tables).some(table => !catalog.rows.some(row => row.table_name === table))) throw new Error("Live SQL table coverage differs from manifest");
    const liveColumns = await client.query<{ table_name: string; column_name: string }>("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'");
    for (const table of Object.keys(tables) as SourceTable[]) {
      const actual = liveColumns.rows.filter(row => row.table_name === table).map(row => row.column_name).sort();
      if (JSON.stringify(actual) !== JSON.stringify(columns[table].map(column => column.name).sort())) throw new Error(`Live SQL column coverage differs: ${table}`);
    }
    const rows = {} as MigrationExport["rows"];
    for (const table of Object.keys(tables) as SourceTable[]) {
      // Identifiers come only from the committed manifest, never CLI input.
      const fields = columns[table].map(column => `"${column.name}"${column.type === "Decimal" || column.type === "BigInt" ? "::text" : ""} AS "${column.name}"`).join(", ");
      rows[table] = (await client.query(`SELECT ${fields} FROM "${table}"`)).rows;
    }
    const prismaHistory = catalog.rows.some(row => row.table_name === "_prisma_migrations") ? (await client.query('SELECT * FROM "_prisma_migrations"')).rows : [];
    await client.query("COMMIT");
    // JSON-safe dates while decimal/bigint fields remain strings.
    return JSON.parse(JSON.stringify({ version: 1, schemaSha256: createHash("sha256").update(schema).digest("hex"), exportedAt: new Date().toISOString(), columns, rows, prismaHistory })) as MigrationExport;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
