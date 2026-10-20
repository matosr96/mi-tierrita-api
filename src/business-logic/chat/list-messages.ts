import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { ChatPageResponse } from "../../models/index";
import { findUserById } from "../users/find-user";
import { markChatDelivered } from "./mark-delivered";
import { conversationSql, findVisibleMessage, loadMessages } from "./shared";

export type ChatListFilter = {
  /** Otro participante del privado; sin él, el canal general. */
  peerId?: number | undefined;
  /** Respuestas de un hilo (la conversación sale del mensaje raíz). */
  threadRootId?: number | undefined;
  /** Solo los posteriores a este id (lo nuevo). */
  after?: number | undefined;
  /** Solo los anteriores a este id (historial hacia atrás). */
  before?: number | undefined;
  /** Una ventana alrededor de este mensaje (saltar a un resultado de búsqueda o a un fijado). */
  around?: number | undefined;
  limit: number;
};

const pickIds = async (where: string, params: unknown[], extra: string, order: "ASC" | "DESC", limit: number): Promise<number[]> => {
  const { rows } = await db.query<{ id: number }>(`SELECT m.id FROM chat_messages m WHERE ${where}${extra} ORDER BY m.id ${order} LIMIT ${limit}`, params);
  return rows.map((r) => r.id);
};

/**
 * Mensajes de una conversación en orden cronológico: la principal (sin las respuestas de hilos) o las de un hilo.
 * Consultar no marca como leído (eso lo hace `POST /chat/read` cuando la persona de verdad tiene la conversación a la
 * vista); sí cuenta como entregado.
 */
export const listChatMessages = async (userId: number, filter: ChatListFilter): Promise<ChatPageResponse> => {
  // Cada consulta lleva solo los parámetros que usa (PostgreSQL no admite parámetros sin tipo).
  let where: string;
  const params: unknown[] = [];
  let root: ChatPageResponse["root"];

  if (filter.threadRootId !== undefined) {
    const rootMsg = await findVisibleMessage(userId, filter.threadRootId);
    if (rootMsg.threadRootId !== null) throw domainError(ErrorCodes.VALIDATION, [{ path: "thread", message: "Ese mensaje es una respuesta dentro de un hilo" }]);
    params.push(rootMsg.id);
    where = `m.thread_root_id = $1`;
    [root] = await loadMessages(userId, [rootMsg.id]);
  } else if (filter.peerId !== undefined) {
    if (filter.peerId === userId || (await findUserById(filter.peerId)) === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
    params.push(userId, filter.peerId);
    where = `${conversationSql(filter.peerId, 2)} AND m.thread_root_id IS NULL`;
  } else {
    where = `${conversationSql(null, 0)} AND m.thread_root_id IS NULL`;
  }

  const n = params.length + 1;
  const limit = filter.limit;
  let ids: number[];
  let hasMoreBefore = false;
  let hasMoreAfter = false;

  if (filter.around !== undefined) {
    const half = Math.max(5, Math.floor(limit / 2));
    const older = await pickIds(where, [...params, filter.around], ` AND m.id <= $${n}`, "DESC", half + 1);
    if (!older.includes(filter.around)) throw domainError(ErrorCodes.CHAT_MESSAGE_NOT_FOUND);
    const newer = await pickIds(where, [...params, filter.around], ` AND m.id > $${n}`, "ASC", half + 1);
    hasMoreBefore = older.length > half;
    hasMoreAfter = newer.length > half;
    ids = [...older.slice(0, half).reverse(), ...newer.slice(0, half)];
  } else if (filter.after !== undefined) {
    const newer = await pickIds(where, [...params, filter.after], ` AND m.id > $${n}`, "ASC", limit + 1);
    hasMoreAfter = newer.length > limit;
    ids = newer.slice(0, limit);
  } else if (filter.before !== undefined) {
    const older = await pickIds(where, [...params, filter.before], ` AND m.id < $${n}`, "DESC", limit + 1);
    hasMoreBefore = older.length > limit;
    ids = older.slice(0, limit).reverse();
  } else {
    const latest = await pickIds(where, params, "", "DESC", limit + 1);
    hasMoreBefore = latest.length > limit;
    ids = latest.slice(0, limit).reverse();
  }

  const items = await loadMessages(userId, ids);
  await markChatDelivered(userId).catch((err: unknown) => console.error("No se pudo marcar la entrega del chat:", err));
  return root === undefined ? { items, hasMoreBefore, hasMoreAfter } : { items, hasMoreBefore, hasMoreAfter, root };
};

/** Estado actual de mensajes ya cargados (acuses, fijado, resumen del hilo), tras un aviso en vivo. */
export const chatMessagesState = async (userId: number, ids: number[]) => ({ items: await loadMessages(userId, ids) });
