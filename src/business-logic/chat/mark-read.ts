import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { MarkChatReadRequest } from "../../models/index";
import { findUserById } from "../users/find-user";
import { notifyReceiptChanges } from "./mark-delivered";
import { publishChatEvent } from "./realtime";
import { conversationSql, findVisibleMessage } from "./shared";

/**
 * Visto: la persona tiene la conversación (o el hilo) a la vista. Marca sus acuses como leídos (y entregados, si aún
 * no lo estaban) hasta `upTo`, avisa a los autores para que vean los chulitos de visto y a sus otras pestañas para
 * que bajen los contadores. Solo toca acuses propios: nadie puede marcar como leído por otra persona.
 */
export const markChatRead = async (userId: number, input: MarkChatReadRequest): Promise<{ updated: number }> => {
  const params: unknown[] = [userId];
  let scope: string;
  if (input.threadRootId !== null) {
    const root = await findVisibleMessage(userId, input.threadRootId);
    params.push(root.id);
    scope = `m.thread_root_id = $2`;
  } else {
    if (input.peerId !== null) {
      if (input.peerId === userId || (await findUserById(input.peerId)) === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
      params.push(input.peerId);
    }
    scope = conversationSql(input.peerId, 2) + (input.includeThreads ? "" : " AND m.thread_root_id IS NULL");
  }
  if (input.upTo !== null) {
    params.push(input.upTo);
    scope += ` AND m.id <= $${params.length}`;
  }

  const { rows } = await db.query<{ id: number; userId: number; recipientId: number | null; threadRootId: number | null }>(
    `UPDATE chat_receipts x SET read_at = now(), delivered_at = COALESCE(x.delivered_at, now())
     FROM chat_messages m
     WHERE x.message_id = m.id AND x.user_id = $1 AND x.read_at IS NULL AND ${scope}
     RETURNING m.id, m.user_id AS "userId", m.recipient_id AS "recipientId", m.thread_root_id AS "threadRootId"`,
    params,
  );
  if (rows.length > 0) {
    await notifyReceiptChanges(rows);
    // Las otras pestañas de la misma persona: contadores y, si eran respuestas de hilos, el resumen del mensaje raíz.
    const roots = [...new Set(rows.map((r) => r.threadRootId).filter((id): id is number => id !== null))];
    const first = rows[0]!;
    const where = first.recipientId === null ? { general: true as const } : { general: false as const, pair: [first.userId, first.recipientId] as [number, number] };
    if (roots.length > 0) await publishChatEvent({ kind: "update", audience: [userId], ids: roots, ...where });
    await publishChatEvent({ kind: "team", audience: [userId] });
  }
  return { updated: rows.length };
};
