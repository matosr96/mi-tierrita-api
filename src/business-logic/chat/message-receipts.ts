import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { deliveryStatus, type ChatReceiptEntry, type ChatReceiptsResponse } from "../../models/index";
import type { Role } from "../../security/index";
import { findVisibleMessage } from "./shared";

type Row = { id: number; firstName: string; lastName: string; role: Role; active: boolean; deliveredAt: Date | null; readAt: Date | null };

/**
 * Detalle de un mensaje propio: quién lo leyó, a quién le llegó sin leerlo y quién sigue pendiente. Solo su autor lo
 * consulta (como en cualquier mensajería): los demás no ven qué leyó cada compañero. Las personas desactivadas
 * aparecen marcadas y no cuentan para el estado general.
 */
export const chatMessageReceipts = async (userId: number, id: number): Promise<ChatReceiptsResponse> => {
  const m = await findVisibleMessage(userId, id);
  if (m.userId !== userId) throw domainError(ErrorCodes.ROLE_INSUFFICIENT);
  const { rows } = await db.query<Row>(
    `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", r.name AS role, u.active,
            x.delivered_at AS "deliveredAt", x.read_at AS "readAt"
     FROM chat_receipts x JOIN users u ON u.id = x.user_id JOIN roles r ON r.id = u.role_id
     WHERE x.message_id = $1
     ORDER BY x.read_at NULLS LAST, x.delivered_at NULLS LAST, u.first_name`,
    [id],
  );
  const entry = (r: Row): ChatReceiptEntry => ({
    user: { id: r.id, firstName: r.firstName, lastName: r.lastName, role: r.role, active: r.active },
    deliveredAt: r.deliveredAt?.toISOString() ?? null,
    readAt: r.readAt?.toISOString() ?? null,
  });
  const active = rows.filter((r) => r.active);
  return {
    messageId: id,
    status: deliveryStatus(active.length, active.filter((r) => r.deliveredAt !== null).length, active.filter((r) => r.readAt !== null).length),
    read: rows.filter((r) => r.readAt !== null).map(entry),
    delivered: rows.filter((r) => r.readAt === null && r.deliveredAt !== null).map(entry),
    pending: rows.filter((r) => r.deliveredAt === null).map(entry),
  };
};
