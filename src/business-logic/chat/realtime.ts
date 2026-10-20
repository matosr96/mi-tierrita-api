import { db, isListening, listen } from "../../data-sources/index";

/**
 * Avisos en vivo del chat. Cada cambio (mensaje nuevo, acuse, fijado, lectura) se publica con NOTIFY en el canal
 * `chat_events`; cada instancia de la API lo recibe con LISTEN y lo reparte a las conexiones abiertas (`GET
 * /chat/stream`) de las personas que pueden verlo. El aviso no lleva la conversación entera: la app pide lo nuevo
 * por REST, con los mismos filtros de privacidad de siempre.
 */

/** "all": todo el equipo (canal general); lista: solo esas personas. */
export type ChatAudience = "all" | number[];

/** Conversación del evento: canal general o el par de un privado. */
type Where = { general: true } | { general: false; pair: [number, number] };

export type ChatEvent =
  | (Where & {
      kind: "message";
      audience: ChatAudience;
      messageId: number;
      threadRootId: number | null;
      authorId: number;
      authorName: string;
      preview: string;
      attachments: number;
      mentionIds: number[];
    })
  | (Where & { kind: "update"; audience: ChatAudience; ids: number[] })
  | { kind: "team"; audience: ChatAudience };

/** Lo que recibe la app: la conversación se expresa desde su punto de vista (`peerId` null = canal general). */
export type ChatClientEvent =
  | { type: "message"; id: number; peerId: number | null; threadRootId: number | null; authorId: number; authorName: string; preview: string; attachments: number; mentionsMe: boolean }
  | { type: "update"; ids: number[]; peerId: number | null }
  | { type: "team" };

type Subscriber = { userId: number; send: (event: ChatClientEvent) => void; close: () => void };

const CHANNEL = "chat_events";
const subscribers = new Set<Subscriber>();

const peerOf = (where: Where, userId: number): number | null => (where.general ? null : where.pair[0] === userId ? where.pair[1] : where.pair[0]);

const toClient = (event: ChatEvent, userId: number): ChatClientEvent => {
  switch (event.kind) {
    case "message":
      return {
        type: "message",
        id: event.messageId,
        peerId: peerOf(event, userId),
        threadRootId: event.threadRootId,
        authorId: event.authorId,
        authorName: event.authorName,
        preview: event.preview,
        attachments: event.attachments,
        mentionsMe: event.mentionIds.includes(userId),
      };
    case "update":
      return { type: "update", ids: event.ids, peerId: peerOf(event, userId) };
    case "team":
      return { type: "team" };
  }
};

const deliver = (event: ChatEvent): void => {
  for (const sub of subscribers) {
    if (event.audience !== "all" && !event.audience.includes(sub.userId)) continue;
    try {
      sub.send(toClient(event, sub.userId));
    } catch (err) {
      console.error("No se pudo enviar un aviso del chat:", err);
    }
  }
};

/**
 * Publica un evento. Con LISTEN activo viaja por PostgreSQL (llega a todas las instancias, esta incluida); si la
 * conexión de avisos está caída se entrega solo en esta instancia. Nunca lanza: un aviso perdido lo recupera la app
 * al reconectar.
 */
export const publishChatEvent = async (event: ChatEvent): Promise<void> => {
  if (isListening()) {
    try {
      await db.query(`SELECT pg_notify($1, $2)`, [CHANNEL, JSON.stringify(event)]);
      return;
    } catch (err) {
      console.error("No se pudo publicar el aviso del chat por la base:", err);
    }
  }
  deliver(event);
};

/** Abre la escucha del canal al arrancar la API. */
export const startChatRealtime = async (): Promise<void> => {
  await listen(CHANNEL, (payload) => {
    try {
      deliver(JSON.parse(payload) as ChatEvent);
    } catch (err) {
      console.error("Aviso del chat ilegible:", err);
    }
  });
};

/** Registra una conexión abierta; devuelve la función para darla de baja. */
export const subscribeChat = (userId: number, send: Subscriber["send"], close: Subscriber["close"]): (() => void) => {
  const sub: Subscriber = { userId, send, close };
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
};

/** Cierra todas las conexiones abiertas (apagado ordenado: si no, `server.close` esperaría para siempre). */
export const closeChatStreams = (): void => {
  for (const sub of [...subscribers]) sub.close();
  subscribers.clear();
};

/** Corta las conexiones de una persona (cerró sesión o la desactivaron). */
export const closeChatStreamsOf = (userId: number): void => {
  for (const sub of [...subscribers]) if (sub.userId === userId) sub.close();
};

export const chatEventPreview = (body: string, attachments: number): string => {
  const text = body.replace(/\s+/g, " ").trim();
  if (text === "") return attachments === 1 ? "Envió un archivo" : `Envió ${attachments} archivos`;
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
};
