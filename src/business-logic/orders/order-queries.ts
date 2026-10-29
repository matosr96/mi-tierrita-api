import { ErrorCodes, domainError, todayIso } from "../../common/index";
import type { Queryable } from "../../data-sources/index";
import { toOrderLineResponse, toOrderResponse, type OrderDetailResponse, type OrderLineRow, type OrderRow } from "../../models/index";
import type { Role } from "../../security/roles";
import { assertKindAllowed } from "./order-access";

export const ORDER_COLUMNS = `
  o.id, o.kind, o.supplier_id AS "supplierId", s.name AS "supplierName",
  o.customer_id AS "customerId", c.name AS "customerName",
  o.status, o.due_date AS "dueDate", o.note, o.total,
  (SELECT count(*)::int FROM order_lines l WHERE l.order_id = o.id) AS "lineCount",
  o.created_by AS "createdBy", cu.username AS "createdByUsername",
  o.created_at AS "createdAt", o.updated_at AS "updatedAt",
  o.closed_at AS "closedAt", o.closed_by AS "closedBy", xu.username AS "closedByUsername",
  o.sale_id AS "saleId", sa.invoice_number AS "saleInvoiceNumber"`;

export const ORDER_FROM = `
  FROM orders o
  JOIN users cu ON cu.id = o.created_by
  LEFT JOIN users xu ON xu.id = o.closed_by
  LEFT JOIN suppliers s ON s.id = o.supplier_id
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN sales sa ON sa.id = o.sale_id`;

/** `lock`: bloquea la fila del pedido (FOR UPDATE) para recibir, entregar, editar o cancelar sin carreras. */
export const findOrderById = async (id: number, q: Queryable, lock = false): Promise<OrderRow | undefined> => {
  const { rows } = await q.query<OrderRow>(`SELECT ${ORDER_COLUMNS} ${ORDER_FROM} WHERE o.id = $1 ${lock ? "FOR UPDATE OF o" : ""}`, [id]);
  return rows[0];
};

export const findOrderLines = async (orderId: number, q: Queryable): Promise<OrderLineRow[]> => {
  const { rows } = await q.query<OrderLineRow>(
    `SELECT l.id, l.product_id AS "productId", p.name AS "productName", p.sku,
            l.quantity, l.unit_price AS "unitPrice", l.received_quantity AS "receivedQuantity",
            round(l.quantity * l.unit_price, 2) AS "lineTotal"
     FROM order_lines l JOIN products p ON p.id = l.product_id
     WHERE l.order_id = $1 ORDER BY l.id`,
    [orderId],
  );
  return rows;
};

/** Pedido visible para el rol: 700 si no existe, 613 si es de un tipo que el rol no maneja. */
export const findOrderFor = async (id: number, role: Role, q: Queryable, lock = false): Promise<OrderRow> => {
  const order = await findOrderById(id, q, lock);
  if (order === undefined) throw domainError(ErrorCodes.ORDER_NOT_FOUND);
  assertKindAllowed(role, order.kind);
  return order;
};

export const loadOrderDetail = async (id: number, q: Queryable): Promise<OrderDetailResponse> => {
  const order = await findOrderById(id, q);
  if (order === undefined) throw domainError(ErrorCodes.ORDER_NOT_FOUND);
  const lines = await findOrderLines(id, q);
  return { ...toOrderResponse(order, todayIso()), lines: lines.map(toOrderLineResponse) };
};
