import { db } from "../../data-sources/index";
import { OrderKinds, type CreateOrderRequest, type OrderDetailResponse } from "../../models/index";
import type { Role } from "../../security/roles";
import { checkCustomer, checkSupplier } from "./check-counterpart";
import { assertKindAllowed } from "./order-access";
import { loadOrderDetail } from "./order-queries";
import { insertOrderLines, resolveOrderLines } from "./resolve-order-lines";

/** Crea un pedido pendiente con sus líneas; el total lo calcula el servidor (lo que envíe el cliente se ignora). */
export const createOrder = async (userId: number, role: Role, input: CreateOrderRequest): Promise<OrderDetailResponse> => {
  assertKindAllowed(role, input.kind);
  return db.transaction(async (client) => {
    if (input.kind === OrderKinds.SUPPLIER) await checkSupplier(input.supplierId!, client);
    else await checkCustomer(input.customerId!, client);
    const { lines, total } = await resolveOrderLines(input.kind, input.lines, client);
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO orders (kind, supplier_id, customer_id, due_date, note, total, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.kind, input.supplierId ?? null, input.customerId ?? null, input.dueDate, input.note ?? null, total, userId],
    );
    const id = rows[0]?.id;
    if (id === undefined) throw new Error("INSERT de pedido no devolvió fila");
    await insertOrderLines(id, lines, client);
    return loadOrderDetail(id, client);
  });
};
