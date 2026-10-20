import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { ChatMessageResponse } from "../../models/index";
import { Roles, type Role } from "../../security/index";
import { publishChatEvent } from "./realtime";
import { audienceOf, findVisibleMessage, loadMessages, whereOf, type ChatMessageCore } from "./shared";

/** Elimina su autor; en el canal general la administración también puede retirar cualquier mensaje. */
export const canDelete = (auth: { userId: number; role: Role }, m: Pick<ChatMessageCore, "userId" | "recipientId">): boolean =>
  m.userId === auth.userId || (m.recipientId === null && auth.role === Roles.ADMIN);

/**
 * Elimina un mensaje para todos sin romper el historial: conserva su lugar, sus acuses y su hilo, pero se borran el
 * texto, las menciones, los adjuntos (también el archivo) y el fijado. Lo que nadie había leído deja de contar como
 * no leído.
 */
export const deleteChatMessage = async (auth: { userId: number; role: Role }, id: number): Promise<ChatMessageResponse> => {
  const m = await findVisibleMessage(auth.userId, id);
  if (!canDelete(auth, m)) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  if (m.deletedAt === null) {
    await db.transaction(async (tx) => {
      await tx.query(`UPDATE chat_messages SET body = '', deleted_at = now(), deleted_by = $2, pinned_at = NULL, pinned_by = NULL WHERE id = $1`, [id, auth.userId]);
      await tx.query(`DELETE FROM chat_mentions WHERE message_id = $1`, [id]);
      await tx.query(`DELETE FROM chat_attachments WHERE message_id = $1`, [id]);
      await tx.query(
        `UPDATE chat_receipts SET delivered_at = COALESCE(delivered_at, now()), read_at = COALESCE(read_at, now()) WHERE message_id = $1 AND read_at IS NULL`,
        [id],
      );
    });
    await publishChatEvent({ kind: "update", audience: audienceOf(m), ids: [id], ...whereOf(m) });
    await publishChatEvent({ kind: "team", audience: audienceOf(m) });
  }
  return (await loadMessages(auth.userId, [id]))[0]!;
};
