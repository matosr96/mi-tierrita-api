import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { OPEN_ORDER_STATUSES, OrderKinds, OrderStatuses, type OrderDetailResponse, type ProductBatchResponse, type ReceiveOrderRequest } from "../../models/index";
import type { Role } from "../../security/roles";
import { registerPurchase } from "../suppliers/register-purchase";
import { findOrderFor, findOrderLines, loadOrderDetail } from "./order-queries";
import { planReceipt } from "./plan-receipt";

export type ReceiveOrderResponse = { order: OrderDetailResponse; batches: ProductBatchResponse[] };

/**
 * Recibe (en todo o en parte) un pedido a proveedor. En UNA transacción, con el pedido bloqueado: valida la recepción
 * contra lo que falta (702), registra cada línea como compra con `registerPurchase` (crea el lote y sube el stock con
 * el producto bloqueado), acumula `received_quantity` y deja el pedido en PARTIAL o RECEIVED. Si algo falla no queda
 * ningún lote a medias.
 */
export const receiveOrder = async (id: number, userId: number, role: Role, input: ReceiveOrderRequest): Promise<ReceiveOrderResponse> =>
  db.transaction(async (client) => {
    const order = await findOrderFor(id, role, client, true);
    if (order.kind !== OrderKinds.SUPPLIER) throw domainError(ErrorCodes.VALIDATION, [{ path: "kind", message: "Solo un pedido a proveedor se recibe; un encargo de cliente se entrega" }]);
    if (!OPEN_ORDER_STATUSES.includes(order.status)) throw domainError(ErrorCodes.ORDER_CLOSED, { status: order.status });

    const plan = planReceipt(await findOrderLines(id, client), input.lines);
    const batches: ProductBatchResponse[] = [];
    for (const step of plan.steps) {
      batches.push(await registerPurchase(order.supplierId!, { productId: step.productId, quantity: step.quantity, unitCost: step.unitCost, expiresAt: step.expiresAt }, client));
      await client.query(`UPDATE order_lines SET received_quantity = received_quantity + $2 WHERE id = $1`, [step.lineId, step.quantity]);
    }
    await client.query(
      `UPDATE orders
         SET status = $2, updated_at = now(),
             closed_at = CASE WHEN $3::boolean THEN now() END,
             closed_by = CASE WHEN $3::boolean THEN $4::bigint END
       WHERE id = $1`,
      [id, plan.complete ? OrderStatuses.RECEIVED : OrderStatuses.PARTIAL, plan.complete, userId],
    );
    return { order: await loadOrderDetail(id, client), batches };
  });
