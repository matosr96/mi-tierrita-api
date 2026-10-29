import { todayIso } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import { toOrderResponse, type OrderKind, type OrderRow } from "../../models/index";
import type { Role } from "../../security/roles";
import { kindsForRole } from "./order-access";
import { ORDER_COLUMNS, ORDER_FROM } from "./order-queries";

/**
 * Pedido abierto con fecha comprometida, para el calendario y los avisos.
 * - `kind`: SUPPLIER (llega mercancía) o CUSTOMER (se entrega un encargo).
 * - `status`: PENDING o PARTIAL (este último solo en pedidos a proveedor).
 * - `dueDate`: fecha esperada de llegada o de entrega, YYYY-MM-DD.
 * - `counterpartName`: proveedor o cliente. `supplierId`/`customerId`: el que corresponde al tipo (el otro, null).
 * - `total`: valor del pedido calculado por el servidor; `lineCount`: líneas; `pendingUnits`: unidades por recibir o entregar.
 * - `daysToDue`: días de hoy (hora del negocio) a `dueDate` (negativo si ya pasó); `overdue`: `daysToDue < 0`.
 * - `href`: ruta de la app que abre el pedido (`/pedidos?pedido=<id>`).
 */
export type DueOrder = {
  id: number;
  kind: OrderKind;
  status: "PENDING" | "PARTIAL";
  dueDate: string;
  counterpartName: string;
  supplierId: number | null;
  customerId: number | null;
  total: number;
  lineCount: number;
  pendingUnits: number;
  daysToDue: number;
  overdue: boolean;
  href: string;
};

/**
 * Pedidos abiertos (PENDING/PARTIAL) con `due_date <= untilDate` de los tipos que maneja el rol: SUPPLIER para ADMIN
 * y bodega, CUSTOMER para ADMIN y secretaria. Incluye los ya vencidos (sin límite inferior) salvo que se pase
 * `fromDate` (inclusive). Ordenados por fecha y luego por id. `now` fija "hoy" en pruebas.
 */
export const listDueOrders = async (role: Role, untilDate: string, fromDate?: string, q: Queryable = db, now: Date = new Date()): Promise<DueOrder[]> => {
  const kinds = kindsForRole(role);
  if (kinds.length === 0) return [];
  const { rows } = await q.query<OrderRow & { pendingUnits: number }>(
    `SELECT ${ORDER_COLUMNS},
            (SELECT COALESCE(sum(l.quantity - l.received_quantity), 0)::int FROM order_lines l WHERE l.order_id = o.id) AS "pendingUnits"
     ${ORDER_FROM}
     WHERE o.kind = ANY($1::text[]) AND o.status IN ('PENDING', 'PARTIAL') AND o.due_date <= $2
       AND ($3::date IS NULL OR o.due_date >= $3::date)
     ORDER BY o.due_date, o.id`,
    [kinds, untilDate, fromDate ?? null],
  );
  const today = todayIso(now);
  return rows.map((row) => {
    const order = toOrderResponse(row, today);
    return {
      id: order.id,
      kind: order.kind,
      status: order.status as DueOrder["status"],
      dueDate: order.dueDate,
      counterpartName: order.counterpartName,
      supplierId: order.supplierId,
      customerId: order.customerId,
      total: order.total,
      lineCount: order.lineCount,
      pendingUnits: row.pendingUnits,
      daysToDue: order.daysToDue,
      overdue: order.overdue,
      href: `/pedidos?pedido=${order.id}`,
    };
  });
};
