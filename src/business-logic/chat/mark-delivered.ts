import { db } from "../../data-sources/index";
import { publishChatEvent } from "./realtime";

type Changed = { id: number; userId: number; recipientId: number | null };

/** Avisa a cada autor qué mensajes suyos cambiaron de acuse, para que sus chulitos se actualicen en vivo. */
export const notifyReceiptChanges = async (changed: Changed[]): Promise<void> => {
  const byAuthor = new Map<string, { authorId: number; recipientId: number | null; ids: number[] }>();
  for (const c of changed) {
    const key = `${c.userId}:${c.recipientId ?? 0}`;
    const entry = byAuthor.get(key) ?? { authorId: c.userId, recipientId: c.recipientId, ids: [] };
    entry.ids.push(c.id);
    byAuthor.set(key, entry);
  }
  await Promise.all(
    [...byAuthor.values()].map((e) =>
      publishChatEvent({
        kind: "update",
        audience: [e.authorId],
        ids: [...new Set(e.ids)].slice(0, 200),
        ...(e.recipientId === null ? { general: true as const } : { general: false as const, pair: [e.authorId, e.recipientId] as [number, number] }),
      }),
    ),
  );
};

/**
 * Entregado: la app de la persona recibió los mensajes (abrió el chat, consultó el equipo desde el menú o recibió el
 * aviso en vivo). Marca todos sus acuses pendientes de entrega y avisa a los autores.
 */
export const markChatDelivered = async (userId: number): Promise<void> => {
  const { rows } = await db.query<Changed>(
    `UPDATE chat_receipts x SET delivered_at = now()
     FROM chat_messages m
     WHERE x.user_id = $1 AND x.delivered_at IS NULL AND m.id = x.message_id
     RETURNING m.id, m.user_id AS "userId", m.recipient_id AS "recipientId"`,
    [userId],
  );
  if (rows.length > 0) await notifyReceiptChanges(rows);
};
