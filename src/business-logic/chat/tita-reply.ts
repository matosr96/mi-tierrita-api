import { db } from "../../data-sources/index";
import { mentionsTita, questionFromMention, replyToMention, setChatTitaAction, type TitaActionRequest } from "../ai/mention";
import { chatEventPreview, publishChatEvent } from "./realtime";
import { findVisibleMessage, whereOf } from "./shared";

/**
 * Respuesta de Tita a un mensaje que la menciona (@Tita). Corre en segundo plano después de publicar el mensaje: la
 * respuesta llega como un mensaje más de la conversación (a nombre de quien preguntó, con la marca `tita`), citando
 * la pregunta y dentro del mismo hilo si lo había. Nunca lanza: un fallo se registra en el log.
 */
export const answerTitaMention = async (m: { id: number; userId: number; recipientId: number | null; threadRootId: number | null; body: string }): Promise<void> => {
  if (!mentionsTita(m.body)) return;
  try {
    const where = m.recipientId === null ? "Mención @Tita en el canal general del chat del equipo; responda para todos, corto" : "Mención @Tita en un chat privado del equipo";
    const reply = await replyToMention(m.userId, questionFromMention(m.body), where);
    const id = await db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: number }>(
        `INSERT INTO chat_messages (user_id, recipient_id, body, reply_to_id, thread_root_id, tita, tita_proposals)
         VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id`,
        [m.userId, m.recipientId, reply.body, m.id, m.threadRootId, JSON.stringify(reply.proposals)],
      );
      const created = rows[0]!.id;
      await tx.query(
        m.recipientId === null
          ? `INSERT INTO chat_receipts (message_id, user_id) SELECT $1, id FROM users WHERE active AND id <> $2`
          : `INSERT INTO chat_receipts (message_id, user_id) VALUES ($1, $2)`,
        m.recipientId === null ? [created, m.userId] : [created, m.recipientId],
      );
      return created;
    });
    await publishChatEvent({
      kind: "message",
      audience: m.recipientId === null ? "all" : [m.userId, m.recipientId],
      ...whereOf(m),
      messageId: id,
      threadRootId: m.threadRootId,
      authorId: m.userId,
      authorName: "Tita",
      preview: chatEventPreview(reply.body, 0),
      attachments: 0,
      mentionIds: [m.userId],
    });
  } catch (err) {
    console.error("Tita no pudo responder en el chat:", err instanceof Error ? err.message : err);
  }
};

/** Cómo quedó una tarjeta de Tita en el chat (solo quien la invocó); avisa a la conversación para que todos lo vean. */
export const setChatTitaActionState = async (userId: number, messageId: number, input: TitaActionRequest): Promise<void> => {
  const m = await findVisibleMessage(userId, messageId);
  await setChatTitaAction(userId, messageId, input);
  await publishChatEvent({ kind: "update", audience: m.recipientId === null ? "all" : [m.userId, m.recipientId], ...whereOf(m), ids: [messageId] });
};
