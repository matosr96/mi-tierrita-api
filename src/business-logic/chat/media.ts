import { ErrorCodes, domainError } from "../../common/index";
import { toPageResponse, type PageRequest, type PageResponse } from "../../common/pagination";
import { db } from "../../data-sources/index";
import { extractLinks, type ChatMediaItem, type ChatMediaKind, type ChatPerson } from "../../models/index";
import { findUserById } from "../users/find-user";
import { conversationSql } from "./shared";

type AttachmentRow = { id: number; name: string; mime: string; size: number; durationMs: number | null; messageId: number; createdAt: Date; authorId: number; firstName: string; lastName: string };
type BodyRow = { id: number; body: string; createdAt: Date; authorId: number; firstName: string; lastName: string };

/** Tope de mensajes con enlaces que se revisan (los enlaces se extraen del texto en el servidor, no en SQL). */
const LINK_MESSAGES_MAX = 500;

const KIND_SQL: Record<Exclude<ChatMediaKind, "link">, string> = {
  image: `a.mime LIKE 'image/%'`,
  audio: `a.mime LIKE 'audio/%'`,
  file: `a.mime NOT LIKE 'image/%' AND a.mime NOT LIKE 'audio/%'`,
};

const author = (r: { authorId: number; firstName: string; lastName: string }): ChatPerson => ({ id: r.authorId, firstName: r.firstName, lastName: r.lastName });

/**
 * Contenido de una conversación para el panel de información: fotos, archivos, notas de voz o enlaces, los más
 * recientes primero, con hilos incluidos. Misma privacidad que los mensajes: el canal general lo ve todo el equipo; un
 * privado, solo sus dos participantes (la conversación se arma desde quien pregunta, así que nunca se ve otra).
 */
export const listChatMedia = async (userId: number, filter: { peerId?: number | undefined; kind: ChatMediaKind }, page: PageRequest): Promise<PageResponse<ChatMediaItem>> => {
  // Solo los parámetros que el SQL usa (en el canal general no hace falta ninguno).
  const params: unknown[] = [];
  if (filter.peerId !== undefined) {
    if (filter.peerId === userId || (await findUserById(filter.peerId)) === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
    params.push(userId, filter.peerId);
  }
  const where = `${conversationSql(filter.peerId ?? null, 2)} AND m.deleted_at IS NULL`;

  if (filter.kind === "link") {
    const { rows } = await db.query<BodyRow>(
      `SELECT m.id, m.body, m.created_at AS "createdAt", m.user_id AS "authorId", u.first_name AS "firstName", u.last_name AS "lastName"
       FROM chat_messages m JOIN users u ON u.id = m.user_id
       WHERE ${where} AND m.body ~* 'https?://'
       ORDER BY m.id DESC LIMIT ${LINK_MESSAGES_MAX}`,
      params,
    );
    const all: ChatMediaItem[] = rows.flatMap((r) => extractLinks(r.body).map((url) => ({ kind: "link" as const, messageId: r.id, createdAt: r.createdAt.toISOString(), author: author(r), url })));
    return toPageResponse(page, all.length, all.slice(page.offset, page.offset + page.limit));
  }

  const from = `FROM chat_attachments a JOIN chat_messages m ON m.id = a.message_id JOIN users u ON u.id = m.user_id WHERE ${where} AND ${KIND_SQL[filter.kind]}`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, params),
    db.query<AttachmentRow>(
      `SELECT a.id, a.name, a.mime, a.size, a.duration_ms AS "durationMs", m.id AS "messageId", m.created_at AS "createdAt",
              m.user_id AS "authorId", u.first_name AS "firstName", u.last_name AS "lastName"
       ${from} ORDER BY a.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  const kind = filter.kind;
  return toPageResponse(
    page,
    countRows[0]?.n ?? 0,
    rows.map((r) => ({ kind, messageId: r.messageId, createdAt: r.createdAt.toISOString(), author: author(r), attachment: { id: r.id, name: r.name, mime: r.mime, size: r.size, durationMs: r.durationMs } })),
  );
};
