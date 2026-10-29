import { searchTerm, todayIso, toPageResponse, unaccentSql, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toOrderResponse, type OrderListFilter, type OrderResponse, type OrderRow } from "../../models/index";
import type { Role } from "../../security/roles";
import { listKindsFor } from "./order-access";
import { ORDER_COLUMNS, ORDER_FROM } from "./order-queries";

/**
 * Listado paginado de pedidos de los tipos del rol (613 si pide un tipo ajeno). Primero los abiertos por fecha
 * comprometida (los vencidos arriba), luego los cerrados del más reciente al más antiguo.
 */
export const listOrders = async (role: Role, page: PageRequest, filter: OrderListFilter): Promise<PageResponse<OrderResponse>> => {
  const kinds = listKindsFor(role, filter.kind);
  const params: unknown[] = [kinds];
  const where = ["o.kind = ANY($1::text[])"];
  if (filter.statuses !== undefined) {
    params.push(filter.statuses);
    where.push(`o.status = ANY($${params.length}::text[])`);
  }
  if (filter.from !== undefined) {
    params.push(filter.from);
    where.push(`o.due_date >= $${params.length}`);
  }
  if (filter.to !== undefined) {
    params.push(filter.to);
    where.push(`o.due_date <= $${params.length}`);
  }
  if (filter.q !== undefined) {
    params.push(searchTerm(filter.q));
    const p = `$${params.length}`;
    let byId = "";
    if (/^#?\d{1,15}$/.test(filter.q)) {
      params.push(Number(filter.q.replace("#", "")));
      byId = ` OR o.id = $${params.length}`;
    }
    where.push(`(${unaccentSql("COALESCE(s.name, '')")} LIKE ${p} OR ${unaccentSql("COALESCE(c.name, '')")} LIKE ${p} OR ${unaccentSql("COALESCE(o.note, '')")} LIKE ${p}${byId})`);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${ORDER_FROM} ${whereSql}`, params),
    db.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} ${ORDER_FROM} ${whereSql}
       ORDER BY (o.status IN ('PENDING', 'PARTIAL')) DESC,
                CASE WHEN o.status IN ('PENDING', 'PARTIAL') THEN o.due_date END ASC,
                o.updated_at DESC, o.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  const today = todayIso();
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map((r) => toOrderResponse(r, today)));
};
