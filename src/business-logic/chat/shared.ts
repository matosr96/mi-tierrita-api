import { ErrorCodes, domainError } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import { toChatMessageResponse, type ChatMessageResponse, type ChatMessageRow } from "../../models/index";

/**
 * Piezas comunes del chat: columnas del mensaje vistas por una persona (`$1` es siempre quien consulta) y las reglas
 * de privacidad. Un mensaje del canal general lo ve todo el equipo; uno privado, solo sus dos participantes.
 */
export const CHAT_COLUMNS = `
  m.id, m.client_id AS "clientId", m.user_id AS "userId", u.username, u.first_name AS "firstName", u.last_name AS "lastName",
  r.name AS role, m.recipient_id AS "recipientId", m.body, m.created_at AS "createdAt", m.thread_root_id AS "threadRootId",
  m.pinned_at AS "pinnedAt", m.edited_at AS "editedAt", m.deleted_at AS "deletedAt", q.deleted_at IS NOT NULL AS "quoteDeleted", m.pinned_by AS "pinnedById", pb.first_name || ' ' || pb.last_name AS "pinnedByName",
  q.id AS "quoteId", q.user_id AS "quoteUserId", qu.first_name AS "quoteFirstName", qu.last_name AS "quoteLastName",
  left(q.body, 400) AS "quoteBody", q.recipient_id AS "quoteRecipientId", q.thread_root_id AS "quoteThreadRootId",
  (SELECT count(*)::int FROM chat_attachments qa WHERE q.id IS NOT NULL AND qa.message_id = q.id) AS "quoteAttachments",
  th.replies AS "threadReplies", th.unread AS "threadUnread", th.last_at AS "threadLastAt", th.participants AS "threadParticipants",
  rc.total AS "receiptsTotal", rc.delivered AS "receiptsDelivered", rc.read AS "receiptsRead",
  EXISTS (SELECT 1 FROM chat_receipts mr WHERE mr.message_id = m.id AND mr.user_id = $1 AND mr.read_at IS NULL) AS "unreadByMe",
  EXISTS (SELECT 1 FROM chat_mentions mm WHERE mm.message_id = m.id AND mm.user_id = $1) AS "mentionsMe",
  (SELECT json_agg(json_build_object('id', mu.id, 'username', mu.username, 'firstName', mu.first_name, 'lastName', mu.last_name) ORDER BY mu.id)
     FROM chat_mentions cm JOIN users mu ON mu.id = cm.user_id WHERE cm.message_id = m.id) AS mentions,
  (SELECT json_agg(json_build_object('id', a.id, 'name', a.name, 'mime', a.mime, 'size', a.size) ORDER BY a.id)
     FROM chat_attachments a WHERE a.message_id = m.id) AS attachments`;

export const CHAT_FROM = `
  FROM chat_messages m
  JOIN users u ON u.id = m.user_id
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN users pb ON pb.id = m.pinned_by
  LEFT JOIN chat_messages q ON q.id = m.reply_to_id
  LEFT JOIN users qu ON qu.id = q.user_id
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS replies, max(t.created_at) AS last_at,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM chat_receipts tr WHERE tr.message_id = t.id AND tr.user_id = $1 AND tr.read_at IS NULL))::int AS unread,
           (SELECT json_agg(json_build_object('id', pu.id, 'firstName', pu.first_name, 'lastName', pu.last_name) ORDER BY pu.first_name)
              FROM users pu WHERE pu.id IN (SELECT t2.user_id FROM chat_messages t2 WHERE t2.thread_root_id = m.id)) AS participants
    FROM chat_messages t WHERE m.thread_root_id IS NULL AND t.thread_root_id = m.id
  ) th ON TRUE
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS total, count(x.delivered_at)::int AS delivered, count(x.read_at)::int AS read
    FROM chat_receipts x JOIN users xu ON xu.id = x.user_id AND xu.active
    WHERE m.user_id = $1 AND x.message_id = m.id
  ) rc ON m.user_id = $1`;

/** Lo que la persona `$1` puede ver: el canal general y sus privados. */
export const VISIBLE_SQL = `(m.recipient_id IS NULL OR m.user_id = $1 OR m.recipient_id = $1)`;

/** Conversación desde el punto de vista de `$1`; `peerParam` es el índice del parámetro con el otro participante. */
export const conversationSql = (peerId: number | null, peerParam: number): string =>
  peerId === null ? `m.recipient_id IS NULL` : `((m.user_id = $1 AND m.recipient_id = $${peerParam}) OR (m.user_id = $${peerParam} AND m.recipient_id = $1))`;

/** Datos mínimos de un mensaje para validar permisos. */
export type ChatMessageCore = { id: number; userId: number; recipientId: number | null; threadRootId: number | null; pinnedAt: Date | null; deletedAt: Date | null; body: string };

export const canSee = (userId: number, m: Pick<ChatMessageCore, "userId" | "recipientId">): boolean =>
  m.recipientId === null || m.userId === userId || m.recipientId === userId;

/** El otro participante de un privado visto por `userId`; null en el canal general. */
export const peerFor = (userId: number, m: Pick<ChatMessageCore, "userId" | "recipientId">): number | null =>
  m.recipientId === null ? null : m.userId === userId ? m.recipientId : m.userId;

/** Mismo lugar: canal general o el mismo par de un privado. */
export const sameConversation = (a: Pick<ChatMessageCore, "userId" | "recipientId">, b: Pick<ChatMessageCore, "userId" | "recipientId">): boolean => {
  if (a.recipientId === null || b.recipientId === null) return a.recipientId === b.recipientId;
  const pa = [a.userId, a.recipientId].sort((x, y) => x - y).join("-");
  const pb = [b.userId, b.recipientId].sort((x, y) => x - y).join("-");
  return pa === pb;
};

/** Busca un mensaje que la persona pueda ver; si no existe o es de un privado ajeno responde 609 (no se revela). */
export const findVisibleMessage = async (userId: number, id: number, q: Queryable = db): Promise<ChatMessageCore> => {
  const { rows } = await q.query<ChatMessageCore>(
    `SELECT id, user_id AS "userId", recipient_id AS "recipientId", thread_root_id AS "threadRootId", pinned_at AS "pinnedAt", deleted_at AS "deletedAt", body
     FROM chat_messages WHERE id = $1`,
    [id],
  );
  const m = rows[0];
  if (m === undefined || !canSee(userId, m)) throw domainError(ErrorCodes.CHAT_MESSAGE_NOT_FOUND);
  return m;
};

/** Mensajes completos por id, en el orden pedido, solo los visibles para `userId`. */
export const loadMessages = async (userId: number, ids: number[], q: Queryable = db): Promise<ChatMessageResponse[]> => {
  if (ids.length === 0) return [];
  const { rows } = await q.query<ChatMessageRow>(`SELECT ${CHAT_COLUMNS} ${CHAT_FROM} WHERE m.id = ANY($2::bigint[]) AND ${VISIBLE_SQL} ORDER BY m.id`, [userId, ids]);
  return rows.map(toChatMessageResponse);
};

/** Personas que reciben un mensaje: todo el equipo activo (canal general) o el destinatario (privado). */
export const audienceOf = (m: Pick<ChatMessageCore, "userId" | "recipientId">): "all" | number[] =>
  m.recipientId === null ? "all" : [m.userId, m.recipientId];

export const whereOf = (m: Pick<ChatMessageCore, "userId" | "recipientId">): { general: true } | { general: false; pair: [number, number] } =>
  m.recipientId === null ? { general: true } : { general: false, pair: [m.userId, m.recipientId] };

/**
 * Se puede citar un mensaje visible de la misma conversación o, como **respuesta por privado**, un mensaje del canal
 * general en un privado con su autor (la respuesta no aparece en el canal).
 */
export const canQuote = (userId: number, quoted: Pick<ChatMessageCore, "userId" | "recipientId">, target: Pick<ChatMessageCore, "userId" | "recipientId">): boolean =>
  canSee(userId, quoted) && (sameConversation(quoted, target) || (quoted.recipientId === null && target.recipientId !== null && quoted.userId === target.recipientId));
