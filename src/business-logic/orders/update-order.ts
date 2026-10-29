import { ErrorCodes, domainError, type ValidationIssue } from "../../common/index";
import { db } from "../../data-sources/index";
import { OrderKinds, OrderStatuses, type OrderDetailResponse, type UpdateOrderRequest } from "../../models/index";
import type { Role } from "../../security/roles";
import { checkCustomer, checkSupplier } from "./check-counterpart";
import { findOrderFor, loadOrderDetail } from "./order-queries";
import { insertOrderLines, resolveOrderLines } from "./resolve-order-lines";

/**
 * Edita un pedido pendiente (701 si ya se recibió en parte, se cerró o se canceló). `lines` reemplaza todas las líneas
 * y recalcula el total; la contraparte debe ser la del tipo (400 si no).
 */
export const updateOrder = async (id: number, role: Role, input: UpdateOrderRequest): Promise<OrderDetailResponse> =>
  db.transaction(async (client) => {
    const order = await findOrderFor(id, role, client, true);
    if (order.status !== OrderStatuses.PENDING) throw domainError(ErrorCodes.ORDER_NOT_EDITABLE, { status: order.status });

    const issues: ValidationIssue[] = [];
    if (order.kind === OrderKinds.SUPPLIER && input.customerId !== undefined) issues.push({ path: "customerId", message: "Un pedido a proveedor no lleva cliente" });
    if (order.kind === OrderKinds.CUSTOMER && input.supplierId !== undefined) issues.push({ path: "supplierId", message: "Un pedido de cliente no lleva proveedor" });
    if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
    if (input.supplierId !== undefined) await checkSupplier(input.supplierId, client);
    if (input.customerId !== undefined) await checkCustomer(input.customerId, client);

    let total: number | null = null;
    if (input.lines !== undefined) {
      const priced = await resolveOrderLines(order.kind, input.lines, client);
      await client.query(`DELETE FROM order_lines WHERE order_id = $1`, [id]);
      await insertOrderLines(id, priced.lines, client);
      total = priced.total;
    }
    await client.query(
      `UPDATE orders
         SET supplier_id = COALESCE($2, supplier_id),
             customer_id = COALESCE($3, customer_id),
             due_date = COALESCE($4, due_date),
             note = CASE WHEN $5::boolean THEN $6 ELSE note END,
             total = COALESCE($7, total),
             updated_at = now()
       WHERE id = $1`,
      [id, input.supplierId ?? null, input.customerId ?? null, input.dueDate ?? null, input.note !== undefined, input.note ?? null, total],
    );
    return loadOrderDetail(id, client);
  });
