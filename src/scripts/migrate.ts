/**
 * Aplica las migraciones SQL versionadas de migrations/ (RNF-07).
 *   pnpm db:migrate   → aplica las pendientes, cada una en su propia transacción
 *   pnpm db:status    → muestra cuáles están aplicadas y cuáles faltan
 * Cada archivo aplicado queda registrado en schema_migrations. Un prefijo numérico
 * repetido se rechaza para que dos personas no creen la misma migración.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { db } from "../data-sources/db.js";

const migrationsDir = fileURLToPath(new URL("../../migrations/", import.meta.url));

const ensureControlTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
};

const listMigrationFiles = (): string[] => {
  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
  const prefixes = new Set<string>();
  for (const f of files) {
    const prefix = f.slice(0, 4);
    if (prefixes.has(prefix)) throw new Error(`Prefijo de migración repetido: ${prefix}`);
    prefixes.add(prefix);
  }
  return files;
};

const appliedFiles = async (): Promise<Set<string>> => {
  const { rows } = await db.query<{ filename: string }>(`SELECT filename FROM schema_migrations`);
  return new Set(rows.map((r) => r.filename));
};

const status = async () => {
  const applied = await appliedFiles();
  for (const f of listMigrationFiles()) {
    console.log(`${applied.has(f) ? "aplicada " : "PENDIENTE"}  ${f}`);
  }
};

const apply = async () => {
  const applied = await appliedFiles();
  const pending = listMigrationFiles().filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log("No hay migraciones pendientes.");
    return;
  }
  for (const f of pending) {
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [f]);
    });
    console.log(`aplicada  ${f}`);
  }
};

const main = async () => {
  const command = process.argv[2] ?? "status";
  await ensureControlTable();
  if (command === "apply") await apply();
  else if (command === "status") await status();
  else throw new Error(`Comando desconocido: ${command} (use apply | status)`);
};

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void db.close());
