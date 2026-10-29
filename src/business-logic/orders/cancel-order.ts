import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { OPEN_ORDER_STATUSES, OrderStatuses, type OrderDetailResponse } from "../../models/index";
import type { Role } from "../../security/roles";
import { findOrderFor, loadOrderDetail } from "./order-queries";

/**
 * Cancela un pedido abierto (pendiente o, si es a proveedor, recibido en parte: lo que ya llegó sigue en bodega).
 * 703 si ya estaba cerrado.
 */
export const cancelOrder = async (id: number, userId: number, role: Role): Promise<OrderDetailResponse> =>
  db.transaction(async (client) => {
    const order = await findOrderFor(id, role, client, true);
    if (!OPEN_ORDER_STATUSES.includes(order.status)) throw domainError(ErrorCodes.ORDER_CLOSED, { status: order.status });
    await client.query(`UPDATE orders SET status = $2, closed_at = now(), closed_by = $3, updated_at = now() WHERE id = $1`, [id, OrderStatuses.CANCELLED, userId]);
    return loadOrderDetail(id, client);
  });
