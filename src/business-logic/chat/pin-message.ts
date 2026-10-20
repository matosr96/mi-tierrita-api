import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { ChatMessageResponse } from "../../models/index";
import { Roles, type Role } from "../../security/index";
import { publishChatEvent } from "./realtime";
import { audienceOf, findVisibleMessage, loadMessages, whereOf, type ChatMessageCore } from "./shared";

/** Máximo de mensajes fijados por conversación: lo importante debe seguir siendo poco. */
export const CHAT_PINS_MAX = 10;

/**
 * Quién puede fijar: en el canal general, la administración (son los avisos de todo el equipo); en un privado,
 * cualquiera de los dos participantes. Las respuestas de un hilo no se fijan.
 */
export const canPin = (auth: { userId: number; role: Role }, m: Pick<ChatMessageCore, "recipientId">): boolean =>
  m.recipientId === null ? auth.role === Roles.ADMIN : true;

/** Fija (`pinned` true) o desfija un mensaje y avisa en vivo a quienes ven la conversación. */
export const setChatPin = async (auth: { userId: number; role: Role }, id: number, pinned: boolean): Promise<ChatMessageResponse> => {
  const m = await findVisibleMessage(auth.userId, id);
  if (!canPin(auth, m)) throw domainError(ErrorCodes.ROLE_INSUFFICIENT, { requiredRoles: [Roles.ADMIN] });
  if (pinned && m.deletedAt !== null) throw domainError(ErrorCodes.VALIDATION, [{ path: "id", message: "El mensaje fue eliminado" }]);
  if (m.threadRootId !== null) throw domainError(ErrorCodes.VALIDATION, [{ path: "id", message: "Las respuestas de un hilo no se pueden fijar" }]);

  if (pinned && m.pinnedAt === null) {
    const { rows } = await db.query<{ n: number }>(
      m.recipientId === null
        ? `SELECT count(*)::int AS n FROM chat_messages WHERE pinned_at IS NOT NULL AND recipient_id IS NULL`
        : `SELECT count(*)::int AS n FROM chat_messages WHERE pinned_at IS NOT NULL AND LEAST(user_id, recipient_id) = LEAST($1::bigint, $2::bigint) AND GREATEST(user_id, recipient_id) = GREATEST($1::bigint, $2::bigint)`,
      m.recipientId === null ? [] : [m.userId, m.recipientId],
    );
    if ((rows[0]?.n ?? 0) >= CHAT_PINS_MAX) throw domainError(ErrorCodes.VALIDATION, [{ path: "id", message: `Ya hay ${CHAT_PINS_MAX} mensajes fijados; desfije alguno primero` }]);
    await db.query(`UPDATE chat_messages SET pinned_at = now(), pinned_by = $2 WHERE id = $1 AND pinned_at IS NULL`, [id, auth.userId]);
  } else if (!pinned && m.pinnedAt !== null) {
    await db.query(`UPDATE chat_messages SET pinned_at = NULL, pinned_by = NULL WHERE id = $1`, [id]);
  }
  await publishChatEvent({ kind: "update", audience: audienceOf(m), ids: [id], ...whereOf(m) });
  return (await loadMessages(auth.userId, [id]))[0]!;
};
