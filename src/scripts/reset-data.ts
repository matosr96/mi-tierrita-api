/**
 * Reinicio de los datos de negocio (9/11/2026).
 *   RESET_DATA_CONFIRM=<marca> pnpm db:reset        → vacía las tablas de negocio y deja las cuentas de usuario
 *   RESET_DATA_CONFIRM=<marca> pnpm db:reset:prod   → lo mismo desde `build/`
 *
 * Para qué: una base que arrastra datos de otra etapa (en producción quedó el conjunto de prueba del colmado anterior)
 * y hay que dejarla lista para `pnpm db:seed` sin perder las cuentas reales.
 *
 * Guardas: no hace nada sin `RESET_DATA_CONFIRM`; cada marca se usa UNA sola vez (queda anotada en `data_resets`), así
 * que un arranque repetido con la misma variable no vuelve a borrar. Conserva `users`, `roles`, `schema_migrations` y
 * `data_resets`; todo lo demás se vacía en una sola transacción con `TRUNCATE … RESTART IDENTITY CASCADE`, y si el
 * número de usuarios cambiara la transacción se deshace. Imprime cuántas filas tenía cada tabla.
 */
import { db } from "../data-sources/db";

/** Tablas que sobreviven al reinicio: cuentas, roles y el control de migraciones y de reinicios. */
export const KEEP_TABLES: readonly string[] = ["users", "roles", "schema_migrations", "data_resets"];

/** Tablas a vaciar, en orden alfabético, a partir de las que existen en el esquema `public`. */
export const planTruncate = (tables: readonly string[]): string[] =>
  [...new Set(tables)].filter((t) => !KEEP_TABLES.includes(t)).sort();

const ensureControlTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS data_resets (
      token    TEXT PRIMARY KEY,
      reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      tables   INTEGER NOT NULL
    )`);
};

export const runReset = async (token: string | undefined): Promise<"omitido" | "ya usado" | "hecho"> => {
  const mark = token?.trim();
  if (!mark) {
    console.log("Reinicio de datos omitido: falta RESET_DATA_CONFIRM.");
    return "omitido";
  }
  await ensureControlTable();
  const used = await db.query(`SELECT reset_at FROM data_resets WHERE token = $1`, [mark]);
  if (used.rowCount) {
    console.log(`Reinicio de datos omitido: la marca «${mark}» ya se usó el ${String(used.rows[0]!.reset_at)}.`);
    return "ya usado";
  }

  const { rows } = await db.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const tables = planTruncate(rows.map((r) => r.tablename));

  await db.transaction(async (client) => {
    const usersBefore = Number((await client.query<{ n: string }>(`SELECT count(*) AS n FROM users`)).rows[0]!.n);
    for (const t of tables) {
      const n = Number((await client.query<{ n: string }>(`SELECT count(*) AS n FROM "${t}"`)).rows[0]!.n);
      console.log(`  ${t.padEnd(36)} ${String(n).padStart(6)} filas`);
    }
    await client.query(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
    const usersAfter = Number((await client.query<{ n: string }>(`SELECT count(*) AS n FROM users`)).rows[0]!.n);
    if (usersAfter !== usersBefore) throw new Error(`El reinicio tocaría users (${usersBefore} → ${usersAfter}); se deshace.`);
    await client.query(`INSERT INTO data_resets (token, tables) VALUES ($1, $2)`, [mark, tables.length]);
  });
  console.log(`Reinicio de datos hecho con la marca «${mark}»: ${tables.length} tablas vaciadas; users intacta.`);
  return "hecho";
};

if (require.main === module) {
  runReset(process.env.RESET_DATA_CONFIRM)
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => void db.close());
}
