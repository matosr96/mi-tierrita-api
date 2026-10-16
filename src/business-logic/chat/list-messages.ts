import { db } from "../../data-sources/index";
import { toChatMessageResponse, type ChatMessageResponse, type ChatMessageRow } from "../../models/index";

export const CHAT_COLUMNS = `m.id, m.user_id AS "userId", u.username, u.first_name AS "firstName", u.last_name AS "lastName",
  r.name AS role, m.body, m.created_at AS "createdAt"`;
export const CHAT_FROM = `FROM chat_messages m JOIN users u ON u.id = m.user_id JOIN roles r ON r.id = u.role_id`;

/**
 * Mensajes del chat en orden cronológico. Sin `after`, los últimos `limit`; con `after`, solo los posteriores a ese id
 * (así el cliente pide únicamente lo nuevo cada pocos segundos).
 */
export const listChatMessages = async (filter: { after?: number | undefined; limit: number }): Promise<{ items: ChatMessageResponse[] }> => {
  const { rows } =
    filter.after === undefined
      ? await db.query<ChatMessageRow>(`SELECT * FROM (SELECT ${CHAT_COLUMNS} ${CHAT_FROM} ORDER BY m.id DESC LIMIT $1) t ORDER BY id`, [filter.limit])
      : await db.query<ChatMessageRow>(`SELECT ${CHAT_COLUMNS} ${CHAT_FROM} WHERE m.id > $1 ORDER BY m.id LIMIT $2`, [filter.after, filter.limit]);
  return { items: rows.map(toChatMessageResponse) };
};
