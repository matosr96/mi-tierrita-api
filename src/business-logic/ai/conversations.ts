import { ErrorCodes, domainError, toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import {
  toAiConversationResponse,
  toAiMessageResponse,
  type AiConversationResponse,
  type AiConversationRow,
  type AiMessageResponse,
  type AiMessageRow,
  type ChatTurn,
  type ConversationEventRequest,
  type Screen,
  type StoredAttachment,
} from "../../models/index";
import type { AssistantReply } from "./assistant";

/**
 * Historial de conversaciones con Tita (brief de octubre de 2026, punto 3). Cada persona ve solo las suyas. El
 * servidor guarda la última pregunta y la respuesta de cada vuelta; la app sigue enviando la conversación completa
 * al modelo (con las notas de lo confirmado) porque es ella quien sabe cómo quedó cada tarjeta.
 */
const CONVERSATION_COLUMNS = `c.id, c.title, c.screen, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
  (SELECT count(*)::int FROM ai_messages m WHERE m.conversation_id = c.id) AS messages`;
const MESSAGE_COLUMNS = `id, role, content, attachments, sources, proposals, actions, error, created_at AS "createdAt"`;

/** Título a partir de la primera pregunta: una línea corta sin saltos. */
export const conversationTitle = (firstQuestion: string): string => {
  const line = firstQuestion.replace(/\s+/g, " ").trim();
  return line.length > 80 ? `${line.slice(0, 79)}…` : line || "Conversación";
};

const stripAttachments = (turn: ChatTurn): StoredAttachment[] | null => (turn.attachments?.length ? turn.attachments.map((a) => ({ kind: a.kind, name: a.name })) : null);

export const createConversation = async (userId: number, title: string, screen: Screen | undefined): Promise<number> => {
  const { rows } = await db.query<{ id: number }>(`INSERT INTO ai_conversations (user_id, title, screen) VALUES ($1, $2, $3) RETURNING id`, [userId, title, screen ?? null]);
  return rows[0]!.id;
};

/** Comprueba que la conversación exista y sea de la persona (663 si no). */
export const requireOwnConversation = async (userId: number, id: number): Promise<void> => {
  const { rowCount } = await db.query(`SELECT 1 FROM ai_conversations WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (rowCount === 0) throw domainError(ErrorCodes.AI_CONVERSATION_NOT_FOUND);
};

const touch = (conversationId: number) => db.query(`UPDATE ai_conversations SET updated_at = now() WHERE id = $1`, [conversationId]);

export const appendUserMessage = async (conversationId: number, turn: ChatTurn): Promise<number> => {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO ai_messages (conversation_id, role, content, attachments) VALUES ($1, 'user', $2, $3) RETURNING id`,
    [conversationId, turn.content, stripAttachments(turn) === null ? null : JSON.stringify(stripAttachments(turn))],
  );
  await touch(conversationId);
  return rows[0]!.id;
};

export const appendAssistantMessage = async (conversationId: number, reply: AssistantReply): Promise<number> => {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO ai_messages (conversation_id, role, content, sources, proposals) VALUES ($1, 'assistant', $2, $3, $4) RETURNING id`,
    [conversationId, reply.reply, JSON.stringify(reply.sources), JSON.stringify(reply.proposals)],
  );
  await touch(conversationId);
  return rows[0]!.id;
};

/** Deja constancia de que Tita no respondió (la app muestra el error; al retomar se ve que la pregunta quedó sin respuesta). */
export const appendFailure = async (conversationId: number, code: string): Promise<void> => {
  await db.query(`INSERT INTO ai_messages (conversation_id, role, content, error) VALUES ($1, 'event', $2, true)`, [conversationId, `Tita no respondió (código ${code}).`]);
};

/** Nota de la persona (tarjeta confirmada o descartada) y estado de esa tarjeta en el mensaje de Tita. */
export const addConversationEvent = async (userId: number, conversationId: number, input: ConversationEventRequest): Promise<{ id: number }> => {
  await requireOwnConversation(userId, conversationId);
  return db.transaction(async (client) => {
    if (input.messageId !== undefined && input.index !== undefined && input.status !== undefined) {
      const state = JSON.stringify({ status: input.status, ...(input.note ? { note: input.note } : {}) });
      await client.query(
        `UPDATE ai_messages SET actions = COALESCE(actions, '{}'::jsonb) || jsonb_build_object($3::text, $4::jsonb)
         WHERE id = $1 AND conversation_id = $2 AND role = 'assistant'`,
        [input.messageId, conversationId, String(input.index), state],
      );
    }
    const { rows } = await client.query<{ id: number }>(`INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'event', $2) RETURNING id`, [conversationId, input.content]);
    await client.query(`UPDATE ai_conversations SET updated_at = now() WHERE id = $1`, [conversationId]);
    return { id: rows[0]!.id };
  });
};

export const listConversations = async (userId: number, page: PageRequest): Promise<PageResponse<AiConversationResponse>> => {
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM ai_conversations WHERE user_id = $1`, [userId]),
    db.query<AiConversationRow>(`SELECT ${CONVERSATION_COLUMNS} FROM ai_conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC, c.id DESC LIMIT $2 OFFSET $3`, [userId, page.limit, page.offset]),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toAiConversationResponse));
};

export const getConversation = async (userId: number, id: number): Promise<AiConversationResponse & { items: AiMessageResponse[] }> => {
  const { rows } = await db.query<AiConversationRow>(`SELECT ${CONVERSATION_COLUMNS} FROM ai_conversations c WHERE c.id = $1 AND c.user_id = $2`, [id, userId]);
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.AI_CONVERSATION_NOT_FOUND);
  const { rows: messages } = await db.query<AiMessageRow>(`SELECT ${MESSAGE_COLUMNS} FROM ai_messages WHERE conversation_id = $1 ORDER BY id`, [id]);
  return { ...toAiConversationResponse(row), items: messages.map(toAiMessageResponse) };
};

export const deleteConversation = async (userId: number, id: number): Promise<void> => {
  const { rowCount } = await db.query(`DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (rowCount === 0) throw domainError(ErrorCodes.AI_CONVERSATION_NOT_FOUND);
};
