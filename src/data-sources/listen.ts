import pg from "pg";
import { config } from "../server/config";

/**
 * Conexión dedicada a PostgreSQL para LISTEN/NOTIFY: los avisos en vivo (chat) viajan por la base, así que llegan a
 * todas las instancias de la API aunque haya más de una. No usa el pool porque LISTEN necesita una sesión fija.
 * Si la conexión se cae, reintenta con espera creciente; mientras tanto `isListening()` es false y quien publica
 * entrega los avisos solo en esta instancia.
 */
type Handler = (payload: string) => void;

const handlers = new Map<string, Set<Handler>>();
let client: pg.Client | null = null;
let connecting: Promise<void> | null = null;
let listening = false;
let retryMs = 1_000;
let stopped = false;

const quoteIdent = (channel: string): string => `"${channel.replace(/"/g, '""')}"`;

const connect = async (): Promise<void> => {
  const c = new pg.Client({ ...config.db });
  c.on("notification", (msg) => {
    if (msg.payload === undefined) return;
    for (const h of handlers.get(msg.channel) ?? []) h(msg.payload);
  });
  c.on("error", (err) => {
    console.error("Se perdió la conexión de avisos en vivo:", err.message);
    void reconnect(c);
  });
  c.on("end", () => void reconnect(c));
  await c.connect();
  for (const channel of handlers.keys()) await c.query(`LISTEN ${quoteIdent(channel)}`);
  client = c;
  listening = true;
  retryMs = 1_000;
};

const reconnect = async (dead: pg.Client): Promise<void> => {
  if (client !== dead && client !== null) return;
  client = null;
  listening = false;
  dead.removeAllListeners();
  void dead.end().catch(() => undefined);
  if (stopped) return;
  const wait = retryMs;
  retryMs = Math.min(retryMs * 2, 30_000);
  setTimeout(() => void ensureConnected(), wait).unref();
};

const ensureConnected = async (): Promise<void> => {
  if (client !== null || stopped) return;
  connecting ??= connect()
    .catch((err: unknown) => {
      console.error("No se pudo abrir la conexión de avisos en vivo:", err instanceof Error ? err.message : err);
      const wait = retryMs;
      retryMs = Math.min(retryMs * 2, 30_000);
      setTimeout(() => void ensureConnected(), wait).unref();
    })
    .finally(() => {
      connecting = null;
    });
  await connecting;
};

/** Escucha un canal de NOTIFY; abre la conexión dedicada la primera vez. */
export const listen = async (channel: string, handler: Handler): Promise<void> => {
  const isNew = !handlers.has(channel);
  if (isNew) handlers.set(channel, new Set());
  handlers.get(channel)!.add(handler);
  if (client === null) await ensureConnected();
  else if (isNew) await client.query(`LISTEN ${quoteIdent(channel)}`);
};

export const isListening = (): boolean => listening;

/** Cierra la conexión dedicada (apagado ordenado del proceso). */
export const stopListening = async (): Promise<void> => {
  stopped = true;
  listening = false;
  const c = client;
  client = null;
  if (c !== null) {
    c.removeAllListeners();
    await c.end().catch(() => undefined);
  }
};
