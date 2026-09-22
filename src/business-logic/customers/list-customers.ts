import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toCustomerResponse, type CustomerResponse, type CustomerRow } from "../../models/index";
import { CUSTOMER_COLUMNS } from "./find-customer";

export type CustomerListFilter = { active?: boolean | undefined; search?: string | undefined; withBalance?: boolean | undefined };

export const listCustomers = async (page: PageRequest, filter: CustomerListFilter): Promise<PageResponse<CustomerResponse>> => {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.active !== undefined) {
    params.push(filter.active);
    conditions.push(`active = $${params.length}`);
  }
  if (filter.withBalance === true) conditions.push(`balance > 0`);
  if (filter.search !== undefined && filter.search !== "") {
    params.push(`%${filter.search}%`);
    conditions.push(`(name ILIKE $${params.length} OR document_id ILIKE $${params.length})`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM customers ${where}`, params),
    db.query<CustomerRow>(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers ${where} ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toCustomerResponse));
};
