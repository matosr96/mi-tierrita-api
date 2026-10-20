import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { extractMentions, type ChatMessageResponse, type CreateChatMessageRequest } from "../../models/index";
import { findUserById } from "../users/find-user";
import { chatEventPreview, publishChatEvent } from "./realtime";
import { canQuote, findVisibleMessage, loadMessages, sameConversation, whereOf, type ChatMessageCore } from "./shared";

const invalid = (path: string, message: string) => domainError(ErrorCodes.VALIDATION, [{ path, message }]);

/**
 * Publica un mensaje en el canal general o, con `recipientId`, uno privado. Puede citar otro mensaje (`replyToId`),
 * ir dentro de un hilo (`threadRootId`) y llevar adjuntos ya subidos. Reglas:
 * - la cita y el hilo deben ser de la misma conversación; la única excepción es la **respuesta por privado**: un
 *   privado al autor de un mensaje del canal general puede citarlo, y la respuesta no aparece en el canal;
 * - un hilo se abre sobre un mensaje de la conversación principal (no hay hilos dentro de hilos);
 * - los adjuntos deben ser de quien escribe y no estar usados en otro mensaje;
 * - con el mismo `clientId` (reintento de la app) se devuelve el mensaje ya guardado y no se duplica.
 * Cada destinatario recibe un acuse (entregado/leído); las menciones solo valen para quien puede ver el mensaje.
 */
export const createChatMessage = async (userId: number, input: CreateChatMessageRequest): Promise<ChatMessageResponse> => {
  if (input.clientId !== null) {
    const { rows } = await db.query<{ id: number }>(`SELECT id FROM chat_messages WHERE user_id = $1 AND client_id = $2`, [userId, input.clientId]);
    if (rows[0] !== undefined) return (await loadMessages(userId, [rows[0].id]))[0]!;
  }

  if (input.recipientId !== null) {
    if (input.recipientId === userId) throw invalid("recipientId", "No puede escribirse a sí mismo");
    const recipient = await findUserById(input.recipientId);
    if (recipient === undefined || !recipient.active) throw domainError(ErrorCodes.USER_NOT_FOUND);
  }
  const target = { userId, recipientId: input.recipientId };

  let thread: ChatMessageCore | null = null;
  if (input.threadRootId !== null) {
    thread = await findVisibleMessage(userId, input.threadRootId);
    if (thread.threadRootId !== null) throw invalid("threadRootId", "No se puede abrir un hilo dentro de otro hilo");
    if (!sameConversation(thread, target)) throw invalid("threadRootId", "El hilo es de otra conversación");
  }
  if (input.replyToId !== null) {
    const quoted = await findVisibleMessage(userId, input.replyToId);
    if (quoted.deletedAt !== null) throw invalid("replyToId", "Ese mensaje fue eliminado");
    const privateReply = !sameConversation(quoted, target);
    if (!canQuote(userId, quoted, target)) throw invalid("replyToId", "Solo se puede citar un mensaje de la misma conversación o responder por privado a su autor");
    if (thread !== null && !privateReply && quoted.id !== thread.id && quoted.threadRootId !== thread.id) throw invalid("replyToId", "La cita debe ser de este hilo");
  }

  const { mentions, created } = await db.transaction(async (tx) => {
    const { rows: inserted } = await tx.query<{ id: number }>(
      `INSERT INTO chat_messages (user_id, recipient_id, body, reply_to_id, thread_root_id, client_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [userId, input.recipientId, input.body, input.replyToId, input.threadRootId, input.clientId],
    );
    const id = inserted[0]?.id;
    // Otro envío con el mismo clientId ganó la carrera: ese es el mensaje.
    if (id === undefined) return { mentions: [] as number[], created: null };

    if (input.attachmentIds.length > 0) {
      const { rowCount } = await tx.query(`UPDATE chat_attachments SET message_id = $1 WHERE id = ANY($2::bigint[]) AND user_id = $3 AND message_id IS NULL`, [
        id,
        input.attachmentIds,
        userId,
      ]);
      if (rowCount !== input.attachmentIds.length) throw invalid("attachmentIds", "Algún adjunto no existe, no es suyo o ya se envió");
    }

    // Destinatarios: el equipo activo (canal general) o la otra persona (privado).
    const { rows: audience } = await tx.query<{ id: number; username: string }>(
      input.recipientId === null ? `SELECT id, username FROM users WHERE active AND id <> $1` : `SELECT id, username FROM users WHERE id = $1`,
      [input.recipientId ?? userId],
    );
    if (audience.length > 0) {
      await tx.query(`INSERT INTO chat_receipts (message_id, user_id) SELECT $1, unnest($2::bigint[])`, [id, audience.map((a) => a.id)]);
    }

    const { usernames, everyone } = extractMentions(input.body);
    const wanted = new Set(usernames);
    const mentioned = audience.filter((a) => (everyone && input.recipientId === null) || wanted.has(a.username.toLowerCase())).map((a) => a.id);
    if (mentioned.length > 0) await tx.query(`INSERT INTO chat_mentions (message_id, user_id) SELECT $1, unnest($2::bigint[])`, [id, mentioned]);
    return { mentions: mentioned, created: id };
  });

  const messageId =
    created ?? (await db.query<{ id: number }>(`SELECT id FROM chat_messages WHERE user_id = $1 AND client_id = $2`, [userId, input.clientId])).rows[0]?.id;
  if (messageId === undefined) throw new Error("INSERT de mensaje no devolvió id");
  const message = (await loadMessages(userId, [messageId]))[0]!;

  if (created !== null) {
    // Limpieza perezosa de adjuntos subidos y nunca enviados.
    void db.query(`DELETE FROM chat_attachments WHERE message_id IS NULL AND created_at < now() - interval '1 day'`).catch(() => undefined);
    await publishChatEvent({
      kind: "message",
      audience: input.recipientId === null ? "all" : [userId, input.recipientId],
      ...whereOf(target),
      messageId,
      threadRootId: input.threadRootId,
      authorId: userId,
      authorName: `${message.firstName} ${message.lastName}`,
      preview: chatEventPreview(input.body, message.attachments.length),
      attachments: message.attachments.length,
      mentionIds: mentions,
    });
  }
  return message;
};

