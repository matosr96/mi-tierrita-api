import { db } from "../../data-sources/index";
import type { ChatMemberResponse, ChatPreview, ChatTeamResponse } from "../../models/index";
import type { Role } from "../../security/index";
import { markChatDelivered } from "./mark-delivered";

/** Se considera en línea a quien hizo una petición en los últimos 90 segundos y no cerró sesión después. */
const ONLINE_SQL = `COALESCE(u.last_seen_at > now() - interval '90 seconds' AND (u.last_signout_at IS NULL OR u.last_signout_at < u.last_seen_at), FALSE)`;

type MemberRow = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  online: boolean;
  lastSeenAt: Date | null;
  unread: number;
  mentions: number;
  lastBody: string | null;
  lastAttachments: number | null;
  lastDeleted: boolean | null;
  lastAt: Date | null;
  lastMine: boolean | null;
};

const preview = (body: string | null, attachments: number | null, at: Date | null, mine: boolean | null, deleted: boolean | null): ChatPreview => {
  if (body === null || at === null) return null;
  const text = deleted ? "Se eliminó este mensaje" : body.trim() === "" ? ((attachments ?? 0) === 1 ? "📎 Archivo" : `📎 ${attachments ?? 0} archivos`) : body;
  return { body: text.length > 90 ? `${text.slice(0, 89)}…` : text, createdAt: at.toISOString(), mine: Boolean(mine) };
};

/** Último mensaje de la conversación principal (sin respuestas de hilos) visto desde `m`. */
const LAST_SQL = (where: string) => `
  SELECT m.body, m.created_at, m.user_id, m.deleted_at IS NOT NULL AS deleted, (SELECT count(*)::int FROM chat_attachments a WHERE a.message_id = m.id) AS attachments
  FROM chat_messages m WHERE ${where} AND m.thread_root_id IS NULL ORDER BY m.id DESC LIMIT 1`;

/**
 * Panel "Equipo" del chat: cada persona activa con su presencia, lo que falta por leer de su privado (hilos
 * incluidos), cuántas menciones sin leer hay y el último mensaje. Consultarlo cuenta como "entregado".
 */
export const chatTeam = async (userId: number): Promise<ChatTeamResponse> => {
  await markChatDelivered(userId).catch((err: unknown) => console.error("No se pudo marcar la entrega del chat:", err));
  const [{ rows: members }, { rows: general }] = await Promise.all([
    db.query<MemberRow>(
      `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.username, r.name AS role,
              ${ONLINE_SQL} AS online, u.last_seen_at AS "lastSeenAt",
              COALESCE(un.unread, 0) AS unread, COALESCE(un.mentions, 0) AS mentions,
              last.body AS "lastBody", last.attachments AS "lastAttachments", last.deleted AS "lastDeleted", last.created_at AS "lastAt", last.user_id = $1 AS "lastMine"
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS unread,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM chat_mentions cm WHERE cm.message_id = m.id AND cm.user_id = $1))::int AS mentions
         FROM chat_receipts x JOIN chat_messages m ON m.id = x.message_id
         WHERE x.user_id = $1 AND x.read_at IS NULL AND m.user_id = u.id AND m.recipient_id = $1
       ) un ON TRUE
       LEFT JOIN LATERAL (${LAST_SQL("((m.user_id = $1 AND m.recipient_id = u.id) OR (m.user_id = u.id AND m.recipient_id = $1))")}) last ON TRUE
       WHERE u.active AND u.id <> $1
       ORDER BY ${ONLINE_SQL} DESC, last.created_at DESC NULLS LAST, u.first_name`,
      [userId],
    ),
    db.query<{ unread: number; mentions: number; lastBody: string | null; lastAttachments: number | null; lastDeleted: boolean | null; lastAt: Date | null; lastMine: boolean | null; onlineCount: number }>(
      `SELECT COALESCE(un.unread, 0) AS unread, COALESCE(un.mentions, 0) AS mentions,
              last.body AS "lastBody", last.attachments AS "lastAttachments", last.deleted AS "lastDeleted", last.created_at AS "lastAt", last.user_id = $1 AS "lastMine",
              (SELECT count(*)::int FROM users u WHERE u.active AND ${ONLINE_SQL}) AS "onlineCount"
       FROM (SELECT 1) one
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS unread,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM chat_mentions cm WHERE cm.message_id = m.id AND cm.user_id = $1))::int AS mentions
         FROM chat_receipts x JOIN chat_messages m ON m.id = x.message_id
         WHERE x.user_id = $1 AND x.read_at IS NULL AND m.recipient_id IS NULL
       ) un ON TRUE
       LEFT JOIN LATERAL (${LAST_SQL("m.recipient_id IS NULL")}) last ON TRUE`,
      [userId],
    ),
  ]);
  const g = general[0];
  const memberList = members.map(
    (m): ChatMemberResponse => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      username: m.username,
      role: m.role,
      online: m.online,
      lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
      unread: m.unread,
      mentions: m.mentions,
      lastMessage: preview(m.lastBody, m.lastAttachments, m.lastAt, m.lastMine, m.lastDeleted),
    }),
  );
  const generalUnread = g?.unread ?? 0;
  return {
    general: { unread: generalUnread, mentions: g?.mentions ?? 0, lastMessage: preview(g?.lastBody ?? null, g?.lastAttachments ?? null, g?.lastAt ?? null, g?.lastMine ?? null, g?.lastDeleted ?? null) },
    onlineCount: g?.onlineCount ?? 0,
    members: memberList,
    unreadTotal: generalUnread + memberList.reduce((n, m) => n + m.unread, 0),
  };
};
