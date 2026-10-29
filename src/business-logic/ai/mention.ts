import { ErrorCodes, domainError, isDomainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { ActionStatus, CommentEntity } from "../../models/index";
import { findUserById } from "../users/find-user";
import { aiEnabled } from "./client";
import { askAssistant } from "./assistant";
import type { Proposal } from "./tool-kit";

/**
 * Mención @Tita en el chat del equipo y en los comentarios de un registro (brief de octubre de 2026, punto 7). La
 * respuesta se guarda a nombre de quien la invocó, con la marca `tita`, y lleva las mismas tarjetas de acción que en
 * la conversación de Tita; solo esa persona puede confirmarlas o descartarlas. Tita responde con las herramientas del
 * rol de quien la mencionó: no es una puerta a datos que esa cuenta no ve.
 */
const MENTION = /(^|[^\p{L}\p{N}_@])@tita\b/iu;

export const mentionsTita = (body: string): boolean => MENTION.test(body);

/** La pregunta sin la mención (y sin signos sueltos al inicio). */
export const questionFromMention = (body: string): string => body.replace(/@tita\b/giu, " ").replace(/\s+/g, " ").replace(/^[\s,:;.-]+/, "").trim();

export type TitaReply = { body: string; proposals: Proposal[] };

/** Pregunta a Tita en nombre de la persona; un fallo del proveedor se convierte en un texto, nunca en una excepción. */
export const replyToMention = async (userId: number, question: string, context: string): Promise<TitaReply> => {
  const user = await findUserById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  if (!aiEnabled()) return { body: "Tita no está disponible en este servidor (la IA no está configurada).", proposals: [] };
  if (question === "") return { body: `Hola, ${user.firstName}. Dígame qué necesita después de @Tita y le respondo aquí mismo.`, proposals: [] };
  try {
    const reply = await askAssistant(user.role, userId, user.firstName, [{ role: "user", content: `(${context}) ${question}` }], "chat");
    return { body: reply.reply, proposals: reply.proposals };
  } catch (err) {
    const code = isDomainError(err) ? err.code : ErrorCodes.INTERNAL;
    console.error("Tita no pudo responder a una mención:", err instanceof Error ? err.message : err);
    return { body: `No pude responder en este momento (código ${code}). Intente de nuevo en un momento.`, proposals: [] };
  }
};

/** Cuerpo de `PATCH …/tita-actions`: cómo quedó una tarjeta. */
export type TitaActionRequest = { index: number; status: Exclude<ActionStatus, "idle" | "running">; note?: string | undefined };

const actionState = (input: TitaActionRequest) => JSON.stringify({ status: input.status, ...(input.note ? { note: input.note } : {}) });

/** Estado de una tarjeta de Tita en el chat: solo quien la invocó (el dueño del mensaje) puede fijarlo. */
export const setChatTitaAction = async (userId: number, messageId: number, input: TitaActionRequest): Promise<{ recipientId: number | null }> => {
  const { rows } = await db.query<{ userId: number; recipientId: number | null; tita: boolean; count: number }>(
    `SELECT user_id AS "userId", recipient_id AS "recipientId", tita, COALESCE(jsonb_array_length(tita_proposals), 0)::int AS count FROM chat_messages WHERE id = $1 AND deleted_at IS NULL`,
    [messageId],
  );
  const m = rows[0];
  if (m === undefined || !m.tita) throw domainError(ErrorCodes.CHAT_MESSAGE_NOT_FOUND);
  if (m.userId !== userId) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  if (input.index >= m.count) throw domainError(ErrorCodes.VALIDATION, [{ path: "index", message: "No existe esa tarjeta" }]);
  await db.query(`UPDATE chat_messages SET tita_actions = COALESCE(tita_actions, '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb) WHERE id = $1`, [messageId, String(input.index), actionState(input)]);
  return { recipientId: m.recipientId };
};

/** Igual que la anterior, para un comentario de Tita en un registro. */
export const setCommentTitaAction = async (userId: number, commentId: number, input: TitaActionRequest): Promise<{ entity: CommentEntity; entityId: number }> => {
  const { rows } = await db.query<{ userId: number; tita: boolean; count: number; entity: CommentEntity; entityId: number }>(
    `SELECT user_id AS "userId", tita, COALESCE(jsonb_array_length(tita_proposals), 0)::int AS count, entity, entity_id AS "entityId" FROM record_comments WHERE id = $1 AND deleted_at IS NULL`,
    [commentId],
  );
  const c = rows[0];
  if (c === undefined || !c.tita) throw domainError(ErrorCodes.COMMENT_NOT_FOUND);
  if (c.userId !== userId) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  if (input.index >= c.count) throw domainError(ErrorCodes.VALIDATION, [{ path: "index", message: "No existe esa tarjeta" }]);
  await db.query(`UPDATE record_comments SET tita_actions = COALESCE(tita_actions, '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb) WHERE id = $1`, [commentId, String(input.index), actionState(input)]);
  return { entity: c.entity, entityId: c.entityId };
};
