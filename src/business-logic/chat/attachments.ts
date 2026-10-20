import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { ChatAttachmentInfo, UploadChatAttachmentRequest } from "../../models/index";
import { canSee } from "./shared";

/** Máximo de adjuntos subidos y aún sin enviar por persona (evita llenar la base con archivos huérfanos). */
const PENDING_MAX = 20;

/** Sube un adjunto; queda a nombre de quien lo sube y sin mensaje hasta que lo envíe. */
export const uploadChatAttachment = async (userId: number, file: UploadChatAttachmentRequest): Promise<ChatAttachmentInfo> => {
  await db.query(`DELETE FROM chat_attachments WHERE message_id IS NULL AND created_at < now() - interval '1 day'`);
  const { rows: pending } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM chat_attachments WHERE user_id = $1 AND message_id IS NULL`, [userId]);
  if ((pending[0]?.n ?? 0) >= PENDING_MAX) throw domainError(ErrorCodes.VALIDATION, [{ path: "file", message: "Tiene demasiados archivos sin enviar; envíe o quite alguno" }]);
  const { rows } = await db.query<ChatAttachmentInfo>(
    `INSERT INTO chat_attachments (user_id, name, mime, size, data) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, mime, size`,
    [userId, file.name, file.mime, file.data.length, file.data],
  );
  return rows[0]!;
};

/**
 * Descarga un adjunto si la persona puede ver el mensaje que lo lleva (o si es suyo y aún no lo envía). Si no, 609:
 * no se revela que exista un archivo de un privado ajeno.
 */
export const getChatAttachment = async (userId: number, id: number): Promise<ChatAttachmentInfo & { data: Buffer }> => {
  const { rows } = await db.query<ChatAttachmentInfo & { data: Buffer; ownerId: number; messageUserId: number | null; recipientId: number | null; messageId: number | null }>(
    `SELECT a.id, a.name, a.mime, a.size, a.data, a.user_id AS "ownerId", a.message_id AS "messageId",
            m.user_id AS "messageUserId", m.recipient_id AS "recipientId"
     FROM chat_attachments a LEFT JOIN chat_messages m ON m.id = a.message_id
     WHERE a.id = $1`,
    [id],
  );
  const a = rows[0];
  const allowed = a !== undefined && (a.messageId === null ? a.ownerId === userId : canSee(userId, { userId: a.messageUserId!, recipientId: a.recipientId }));
  if (!allowed) throw domainError(ErrorCodes.CHAT_MESSAGE_NOT_FOUND);
  return { id: a.id, name: a.name, mime: a.mime, size: a.size, data: a.data };
};
