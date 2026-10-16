import { db } from "../../data-sources/index";
import type { ChatMemberResponse, ChatPreview, ChatTeamResponse } from "../../models/index";
import type { Role } from "../../security/index";

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
  lastBody: string | null;
  lastAt: Date | null;
  lastMine: boolean | null;
};

const preview = (body: string | null, at: Date | null, mine: boolean | null): ChatPreview =>
  body === null || at === null ? null : { body: body.length > 90 ? `${body.slice(0, 89)}…` : body, createdAt: at.toISOString(), mine: Boolean(mine) };

/** Panel "Equipo" del chat: cada persona activa con su presencia, sus mensajes privados sin leer y el último mensaje. */
export const chatTeam = async (userId: number): Promise<ChatTeamResponse> => {
  const [{ rows: members }, { rows: general }] = await Promise.all([
    db.query<MemberRow>(
      `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.username, r.name AS role,
              ${ONLINE_SQL} AS online, u.last_seen_at AS "lastSeenAt",
              (SELECT count(*)::int FROM chat_messages m
                 WHERE m.user_id = u.id AND m.recipient_id = $1
                   AND m.id > COALESCE((SELECT last_read_id FROM chat_reads c WHERE c.user_id = $1 AND c.peer_id = u.id), 0)) AS unread,
              last.body AS "lastBody", last.created_at AS "lastAt", last.user_id = $1 AS "lastMine"
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN LATERAL (
         SELECT m.body, m.created_at, m.user_id FROM chat_messages m
         WHERE (m.user_id = $1 AND m.recipient_id = u.id) OR (m.user_id = u.id AND m.recipient_id = $1)
         ORDER BY m.id DESC LIMIT 1
       ) last ON TRUE
       WHERE u.active AND u.id <> $1
       ORDER BY ${ONLINE_SQL} DESC, last.created_at DESC NULLS LAST, u.first_name`,
      [userId],
    ),
    db.query<{ unread: number; lastBody: string | null; lastAt: Date | null; lastMine: boolean | null; onlineCount: number }>(
      `SELECT (SELECT count(*)::int FROM chat_messages m
                 WHERE m.recipient_id IS NULL AND m.user_id <> $1
                   AND m.id > COALESCE((SELECT last_read_id FROM chat_reads c WHERE c.user_id = $1 AND c.peer_id = 0), 0)) AS unread,
              last.body AS "lastBody", last.created_at AS "lastAt", last.user_id = $1 AS "lastMine",
              (SELECT count(*)::int FROM users u WHERE u.active AND ${ONLINE_SQL}) AS "onlineCount"
       FROM (SELECT 1) one
       LEFT JOIN LATERAL (SELECT body, created_at, user_id FROM chat_messages WHERE recipient_id IS NULL ORDER BY id DESC LIMIT 1) last ON TRUE`,
      [userId],
    ),
  ]);
  const g = general[0];
  return {
    general: { unread: g?.unread ?? 0, lastMessage: preview(g?.lastBody ?? null, g?.lastAt ?? null, g?.lastMine ?? null) },
    onlineCount: g?.onlineCount ?? 0,
    members: members.map(
      (m): ChatMemberResponse => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        username: m.username,
        role: m.role,
        online: m.online,
        lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
        unread: m.unread,
        lastMessage: preview(m.lastBody, m.lastAt, m.lastMine),
      }),
    ),
  };
};
