import { searchTerm, unaccentSql } from "../../common/index";
import { db } from "../../data-sources/index";
import type { ChatMessageResponse } from "../../models/index";
import { VISIBLE_SQL, conversationSql, loadMessages } from "./shared";

/**
 * Búsqueda en el chat (sin tildes ni mayúsculas) por texto del mensaje, nombre de un adjunto o autor, y/o por el día
 * en que se escribió (`day`, en la hora del negocio: la sesión de PostgreSQL ya está en esa zona, así que
 * `created_at::date` coincide). Solo recorre lo que la persona puede ver: el canal general y sus propios privados; con
 * `peerId` (o `general`), una sola conversación. Incluye respuestas de hilos (`threadRootId` dice dónde abrirlas).
 */
export const searchChatMessages = async (
  userId: number,
  filter: { q?: string | undefined; day?: string | undefined; peerId?: number | undefined; generalOnly?: boolean | undefined; limit: number },
): Promise<{ items: ChatMessageResponse[] }> => {
  const params: unknown[] = [userId];
  let where = `${VISIBLE_SQL} AND m.deleted_at IS NULL`;
  if (filter.q !== undefined) {
    params.push(searchTerm(filter.q));
    const n = params.length;
    where += ` AND (
      ${unaccentSql("m.body")} LIKE $${n}
      OR ${unaccentSql("u.first_name || ' ' || u.last_name")} LIKE $${n}
      OR EXISTS (SELECT 1 FROM chat_attachments a WHERE a.message_id = m.id AND ${unaccentSql("a.name")} LIKE $${n}))`;
  }
  if (filter.day !== undefined) {
    params.push(filter.day);
    where += ` AND m.created_at::date = $${params.length}::date`;
  }
  if (filter.peerId !== undefined) {
    params.push(filter.peerId);
    where += ` AND ${conversationSql(filter.peerId, params.length)}`;
  } else if (filter.generalOnly === true) {
    where += ` AND ${conversationSql(null, 0)}`;
  }
  params.push(filter.limit);
  const { rows } = await db.query<{ id: number }>(
    `SELECT m.id FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE ${where} ORDER BY m.id DESC LIMIT $${params.length}`,
    params,
  );
  const items = await loadMessages(userId, rows.map((r) => r.id));
  return { items: items.reverse() };
};
