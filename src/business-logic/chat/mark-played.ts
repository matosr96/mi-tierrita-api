import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { hasAudio, type ChatAttachmentInfo } from "../../models/index";
import { notifyReceiptChanges } from "./mark-delivered";
import { publishChatEvent } from "./realtime";
import { findVisibleMessage, type ChatMessageCore } from "./shared";

/** Solo se marca como reproducida la nota de voz de un mensaje ajeno, vigente y que de verdad lleve audio. */
export const canMarkPlayed = (userId: number, m: Pick<ChatMessageCore, "userId" | "deletedAt">, attachments: readonly Pick<ChatAttachmentInfo, "mime">[]): boolean =>
  m.userId !== userId && m.deletedAt === null && hasAudio(attachments);

/**
 * Reproducido: la persona escuchó la nota de voz del mensaje. Marca su acuse (y lo deja entregado y leído si aún no lo
 * estaba: quien reproduce ya lo vio) y avisa al autor para que el micrófono de sus chulitos cambie en vivo. Solo toca
 * el acuse propio; repetirlo no cambia nada.
 */
export const markChatPlayed = async (userId: number, id: number): Promise<{ updated: number }> => {
  const m = await findVisibleMessage(userId, id);
  const { rows: attachments } = await db.query<{ mime: string }>(`SELECT mime FROM chat_attachments WHERE message_id = $1`, [id]);
  if (!canMarkPlayed(userId, m, attachments)) throw domainError(ErrorCodes.VALIDATION, [{ path: "id", message: "Solo se marca como reproducida la nota de voz de otra persona" }]);
  const { rowCount } = await db.query(
    `UPDATE chat_receipts SET played_at = now(), read_at = COALESCE(read_at, now()), delivered_at = COALESCE(delivered_at, now())
     WHERE message_id = $1 AND user_id = $2 AND played_at IS NULL`,
    [id, userId],
  );
  const updated = rowCount ?? 0;
  if (updated > 0) {
    await notifyReceiptChanges([{ id, userId: m.userId, recipientId: m.recipientId }]);
    await publishChatEvent({ kind: "team", audience: [userId] });
  }
  return { updated };
};
