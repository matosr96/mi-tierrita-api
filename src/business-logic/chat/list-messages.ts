import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toChatMessageResponse, type ChatMessageResponse, type ChatMessageRow } from "../../models/index";
import { findUserById } from "../users/find-user";

export const CHAT_COLUMNS = `m.id, m.user_id AS "userId", u.username, u.first_name AS "firstName", u.last_name AS "lastName",
  r.name AS role, m.recipient_id AS "recipientId", m.body, m.created_at AS "createdAt"`;
export const CHAT_FROM = `FROM chat_messages m JOIN users u ON u.id = m.user_id JOIN roles r ON r.id = u.role_id`;

/** Conversación: canal general (sin `peerId`) o privada entre quien consulta y `peerId`. */
const conversation = (userId: number, peerId: number | undefined): { where: string; params: unknown[] } =>
  peerId === undefined
    ? { where: "m.recipient_id IS NULL", params: [] }
    : { where: "((m.user_id = $1 AND m.recipient_id = $2) OR (m.user_id = $2 AND m.recipient_id = $1))", params: [userId, peerId] };

/**
 * Mensajes de una conversación en orden cronológico. Sin `after`, los últimos `limit`; con `after`, solo los
 * posteriores a ese id. Consultar una conversación la marca como leída hasta el último mensaje devuelto.
 */
export const listChatMessages = async (
  userId: number,
  filter: { peerId?: number | undefined; after?: number | undefined; limit: number },
): Promise<{ items: ChatMessageResponse[] }> => {
  if (filter.peerId !== undefined && (filter.peerId === userId || (await findUserById(filter.peerId)) === undefined)) {
    throw domainError(ErrorCodes.USER_NOT_FOUND);
  }
  const { where, params } = conversation(userId, filter.peerId);
  const n = params.length;
  const { rows } =
    filter.after === undefined
      ? await db.query<ChatMessageRow>(`SELECT * FROM (SELECT ${CHAT_COLUMNS} ${CHAT_FROM} WHERE ${where} ORDER BY m.id DESC LIMIT $${n + 1}) t ORDER BY id`, [
          ...params,
          filter.limit,
        ])
      : await db.query<ChatMessageRow>(`SELECT ${CHAT_COLUMNS} ${CHAT_FROM} WHERE ${where} AND m.id > $${n + 1} ORDER BY m.id LIMIT $${n + 2}`, [
          ...params,
          filter.after,
          filter.limit,
        ]);

  const lastId = rows.at(-1)?.id;
  if (lastId !== undefined) {
    await db.query(
      `INSERT INTO chat_reads (user_id, peer_id, last_read_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, peer_id) DO UPDATE SET last_read_id = GREATEST(chat_reads.last_read_id, EXCLUDED.last_read_id)`,
      [userId, filter.peerId ?? 0, lastId],
    );
  }
  return { items: rows.map(toChatMessageResponse) };
};
