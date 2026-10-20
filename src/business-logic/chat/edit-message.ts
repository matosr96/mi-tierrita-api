import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { extractMentions, type ChatMessageResponse } from "../../models/index";
import { publishChatEvent } from "./realtime";
import { audienceOf, findVisibleMessage, loadMessages, whereOf } from "./shared";

/**
 * Edita el texto de un mensaje propio. Las menciones se recalculan (solo entre quienes lo recibieron) y queda la marca
 * "editado"; los acuses no cambian. Un mensaje eliminado no se edita; el texto solo puede quedar vacío si lleva adjuntos.
 */
export const editChatMessage = async (userId: number, id: number, body: string): Promise<ChatMessageResponse> => {
  const m = await findVisibleMessage(userId, id);
  if (m.userId !== userId) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  if (m.deletedAt !== null) throw domainError(ErrorCodes.VALIDATION, [{ path: "id", message: "El mensaje fue eliminado" }]);
  if (body === m.body) return (await loadMessages(userId, [id]))[0]!;

  await db.transaction(async (tx) => {
    if (body === "") {
      const { rows } = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM chat_attachments WHERE message_id = $1`, [id]);
      if ((rows[0]?.n ?? 0) === 0) throw domainError(ErrorCodes.VALIDATION, [{ path: "body", message: "Escriba un mensaje o elimínelo" }]);
    }
    await tx.query(`UPDATE chat_messages SET body = $2, edited_at = now() WHERE id = $1`, [id, body]);
    // Menciones de nuevo, solo entre quienes recibieron el mensaje.
    const { rows: audience } = await tx.query<{ id: number; username: string }>(
      `SELECT u.id, u.username FROM chat_receipts x JOIN users u ON u.id = x.user_id WHERE x.message_id = $1`,
      [id],
    );
    const { usernames, everyone } = extractMentions(body);
    const wanted = new Set(usernames);
    const mentioned = audience.filter((a) => (everyone && m.recipientId === null) || wanted.has(a.username.toLowerCase())).map((a) => a.id);
    await tx.query(`DELETE FROM chat_mentions WHERE message_id = $1`, [id]);
    if (mentioned.length > 0) await tx.query(`INSERT INTO chat_mentions (message_id, user_id) SELECT $1, unnest($2::bigint[])`, [id, mentioned]);
  });

  await publishChatEvent({ kind: "update", audience: audienceOf(m), ids: [id], ...whereOf(m) });
  await publishChatEvent({ kind: "team", audience: audienceOf(m) });
  return (await loadMessages(userId, [id]))[0]!;
};
