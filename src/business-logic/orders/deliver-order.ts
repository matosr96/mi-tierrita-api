import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import { OrderKinds, OrderStatuses, SaleStatuses, type DeliverOrderRequest, type OrderDetailResponse } from "../../models/index";
import type { Role } from "../../security/roles";
import { findSaleById } from "../sales/sale-queries";
import { findOrderFor, loadOrderDetail } from "./order-queries";

/**
 * Marca entregado un encargo de cliente pendiente. `saleId` (opcional) es la venta con que se cobró: debe existir (606),
 * ser del mismo cliente y no estar anulada (704), y no cobrar ya otro encargo (630). Las líneas quedan entregadas.
 */
export const deliverOrder = async (id: number, userId: number, role: Role, input: DeliverOrderRequest): Promise<OrderDetailResponse> =>
  db.transaction(async (client) => {
    const order = await findOrderFor(id, role, client, true);
    if (order.kind !== OrderKinds.CUSTOMER) throw domainError(ErrorCodes.VALIDATION, [{ path: "kind", message: "Solo un encargo de cliente se entrega; un pedido a proveedor se recibe" }]);
    if (order.status !== OrderStatuses.PENDING) throw domainError(ErrorCodes.ORDER_CLOSED, { status: order.status });
    if (input.saleId !== undefined) {
      const sale = await findSaleById(input.saleId, client);
      if (sale === undefined) throw domainError(ErrorCodes.SALE_NOT_FOUND);
      if (sale.customerId !== order.customerId || sale.status === SaleStatuses.VOIDED) {
        throw domainError(ErrorCodes.ORDER_SALE_MISMATCH, { saleCustomerId: sale.customerId, orderCustomerId: order.customerId, saleStatus: sale.status });
      }
    }
    try {
      await client.query(
        `UPDATE orders SET status = $2, sale_id = $3, closed_at = now(), closed_by = $4, updated_at = now() WHERE id = $1`,
        [id, OrderStatuses.DELIVERED, input.saleId ?? null, userId],
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE, { field: "saleId" });
      throw err;
    }
    await client.query(`UPDATE order_lines SET received_quantity = quantity WHERE order_id = $1`, [id]);
    return loadOrderDetail(id, client);
  });
