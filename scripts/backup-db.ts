/**
 * Logical backup of every public table to local JSON.
 *
 * pg_dump is not available in this sandbox, so this reads each table through
 * Prisma and writes one JSON file per table plus a manifest. It is strictly
 * READ-ONLY against the database: SELECTs only, no writes, no schema changes.
 *
 * Binary columns (Document.data) are base64-encoded, since raw byte arrays
 * inflate ~5x as JSON number arrays and 40MB of uploads would become ~200MB.
 *
 * Output: backups/<timestamp>/<table>.json + manifest.json
 *
 *   npx tsx scripts/backup-db.ts
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const db = new PrismaClient();

/** JSON-safe value: Dates to ISO, Buffers to base64, BigInt to string. */
function enc(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return { __base64: v.toString("base64") };
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(enc);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = enc(val);
    return out;
  }
  return v;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join("backups", stamp);
  mkdirSync(dir, { recursive: true });

  const tables: { table_name: string }[] = await db.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  const manifest: { table: string; rows: number; file: string }[] = [];
  let totalRows = 0;

  for (const { table_name } of tables) {
    const rows: unknown[] = await db.$queryRawUnsafe(`SELECT * FROM "${table_name}"`);
    const encoded = enc(rows);
    writeFileSync(join(dir, `${table_name}.json`), JSON.stringify(encoded));
    manifest.push({ table: table_name, rows: rows.length, file: `${table_name}.json` });
    totalRows += rows.length;
    process.stdout.write(`  ${table_name}: ${rows.length}\n`);
  }

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        database: (process.env.DIRECT_URL ?? "").replace(/:[^:@]+@/, ":***@"),
        tables: manifest.length,
        totalRows,
        detail: manifest,
      },
      null,
      2
    )
  );

  console.log(`\nBacked up ${manifest.length} tables, ${totalRows} rows -> ${dir}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
