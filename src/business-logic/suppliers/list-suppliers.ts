import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toSupplierResponse, type SupplierResponse, type SupplierRow } from "../../models/index";
import { SUPPLIER_COLUMNS } from "./find-supplier";

export const listSuppliers = async (page: PageRequest, filter: { active?: boolean | undefined }): Promise<PageResponse<SupplierResponse>> => {
  const where = filter.active === undefined ? "" : "WHERE active = $3";
  const params: unknown[] = [page.limit, page.offset];
  if (filter.active !== undefined) params.push(filter.active);
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM suppliers ${where}`, params.slice(2)),
    db.query<SupplierRow>(`SELECT ${SUPPLIER_COLUMNS} FROM suppliers ${where} ORDER BY name LIMIT $1 OFFSET $2`, params),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toSupplierResponse));
};
