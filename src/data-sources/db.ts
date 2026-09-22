import pg from "pg";
import { config } from "../server/config.js";

/**
 * Única puerta hacia PostgreSQL. Cliente SQL directo (sin ORM): el equipo controla
 * exactamente qué SQL se ejecuta y el esquema se gestiona por migraciones (RNF-07).
 */
const { Pool, types } = pg;

// DECIMAL/NUMERIC (oid 1700) llega como string; los montos de negocio se manejan como
// número en la API y se guardan DECIMAL(12,2) en base (RNF-03).
types.setTypeParser(1700, (value: string) => Number(value));
// BIGINT (oid 20): los ids son bigint pero caben en un number seguro de JS.
types.setTypeParser(20, (value: string) => Number(value));

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => console.error("Error inesperado en el pool de PostgreSQL:", err));

/** Contrato mínimo que comparten el pool y un cliente en transacción. */
export type Queryable = {
  query: <R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<pg.QueryResult<R>>;
};

/** Ejecuta un callback dentro de una transacción; hace rollback si lanza. */
const transaction = async <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const db = {
  pool,
  query: <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) =>
    pool.query<R>(text, params),
  transaction,
  ping: async () => {
    await pool.query("SELECT 1");
  },
  close: () => pool.end(),
};

/** Violación de UNIQUE en PostgreSQL (código 23505): se traduce al código 630. */
export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

/** Violación de FOREIGN KEY (código 23503): un registro referenciado por otros. */
export const isForeignKeyViolation = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
