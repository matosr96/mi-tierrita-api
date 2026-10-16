import { db } from "../../data-sources/index";
import { toChatMessageResponse, type ChatMessageResponse, type ChatMessageRow, type CreateChatMessageRequest } from "../../models/index";
import { CHAT_COLUMNS, CHAT_FROM } from "./list-messages";

/** Publica un mensaje en el chat del equipo a nombre de quien tiene la sesión. */
export const createChatMessage = async (userId: number, input: CreateChatMessageRequest): Promise<ChatMessageResponse> => {
  const { rows: inserted } = await db.query<{ id: number }>(`INSERT INTO chat_messages (user_id, body) VALUES ($1, $2) RETURNING id`, [userId, input.body]);
  const id = inserted[0]?.id;
  if (id === undefined) throw new Error("INSERT de mensaje no devolvió id");
  const { rows } = await db.query<ChatMessageRow>(`SELECT ${CHAT_COLUMNS} ${CHAT_FROM} WHERE m.id = $1`, [id]);
  return toChatMessageResponse(rows[0]!);
};
