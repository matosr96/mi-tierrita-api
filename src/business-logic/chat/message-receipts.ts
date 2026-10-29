import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { deliveryStatus, hasAudio, type ChatReceiptEntry, type ChatReceiptsResponse } from "../../models/index";
import type { Role } from "../../security/index";
import { findVisibleMessage } from "./shared";

type Row = { id: number; firstName: string; lastName: string; role: Role; active: boolean; deliveredAt: Date | null; readAt: Date | null; playedAt: Date | null };

/**
 * Detalle de un mensaje propio: quién lo leyó, a quién le llegó sin leerlo, quién sigue pendiente y, si lleva una nota
 * de voz, quién la reprodujo. Solo su autor lo consulta (como en cualquier mensajería): los demás no ven qué leyó cada
 * compañero. Las personas desactivadas aparecen marcadas y no cuentan para el estado general.
 */
export const chatMessageReceipts = async (userId: number, id: number): Promise<ChatReceiptsResponse> => {
  const m = await findVisibleMessage(userId, id);
  if (m.userId !== userId) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  const [{ rows }, { rows: audioRows }] = await Promise.all([
    db.query<Row>(
      `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", r.name AS role, u.active,
              x.delivered_at AS "deliveredAt", x.read_at AS "readAt", x.played_at AS "playedAt"
       FROM chat_receipts x JOIN users u ON u.id = x.user_id JOIN roles r ON r.id = u.role_id
       WHERE x.message_id = $1
       ORDER BY x.read_at NULLS LAST, x.delivered_at NULLS LAST, u.first_name`,
      [id],
    ),
    db.query<{ mime: string }>(`SELECT mime FROM chat_attachments WHERE message_id = $1`, [id]),
  ]);
  const audio = hasAudio(audioRows);
  const entry = (r: Row): ChatReceiptEntry => ({
    user: { id: r.id, firstName: r.firstName, lastName: r.lastName, role: r.role, active: r.active },
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
    readAt: r.readAt?.toISOString() ?? null,
    playedAt: r.playedAt?.toISOString() ?? null,
  });
  const active = rows.filter((r) => r.active);
  return {
    messageId: id,
    status: deliveryStatus(
      active.length,
      active.filter((r) => r.deliveredAt !== null).length,
      active.filter((r) => r.readAt !== null).length,
      active.filter((r) => r.playedAt !== null).length,
      audio,
    ),
    audio,
    read: rows.filter((r) => r.readAt !== null).map(entry),
    delivered: rows.filter((r) => r.readAt === null && r.deliveredAt !== null).map(entry),
    pending: rows.filter((r) => r.deliveredAt === null).map(entry),
    played: rows.filter((r) => r.playedAt !== null).map(entry),
  };
};
