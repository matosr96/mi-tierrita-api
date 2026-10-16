import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toChatMessageResponse, type ChatMessageResponse, type ChatMessageRow, type CreateChatMessageRequest } from "../../models/index";
import { findUserById } from "../users/find-user";
import { CHAT_COLUMNS, CHAT_FROM } from "./list-messages";

/** Publica un mensaje en el canal general o, con `recipientId`, uno privado a otra persona activa del equipo. */
export const createChatMessage = async (userId: number, input: CreateChatMessageRequest): Promise<ChatMessageResponse> => {
  if (input.recipientId !== null) {
    if (input.recipientId === userId) throw domainError(ErrorCodes.VALIDATION, [{ path: "recipientId", message: "No puede escribirse a sí mismo" }]);
    const recipient = await findUserById(input.recipientId);
    if (recipient === undefined || !recipient.active) throw domainError(ErrorCodes.USER_NOT_FOUND);
  }
  const { rows: inserted } = await db.query<{ id: number }>(`INSERT INTO chat_messages (user_id, recipient_id, body) VALUES ($1, $2, $3) RETURNING id`, [
    userId,
    input.recipientId,
    input.body,
  ]);
  const id = inserted[0]?.id;
  if (id === undefined) throw new Error("INSERT de mensaje no devolvió id");
  // Lo propio cuenta como leído.
  await db.query(
    `INSERT INTO chat_reads (user_id, peer_id, last_read_id) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, peer_id) DO UPDATE SET last_read_id = GREATEST(chat_reads.last_read_id, EXCLUDED.last_read_id)`,
    [userId, input.recipientId ?? 0, id],
  );
  const { rows } = await db.query<ChatMessageRow>(`SELECT ${CHAT_COLUMNS} ${CHAT_FROM} WHERE m.id = $1`, [id]);
  return toChatMessageResponse(rows[0]!);
};
