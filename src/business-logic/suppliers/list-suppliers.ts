import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toSupplierResponse, type SupplierResponse, type SupplierRow } from "../../models/index";
import { SUPPLIER_COLUMNS } from "./find-supplier";

export const listSuppliers = async (page: PageRequest, filter: { active?: boolean | undefined }): Promise<PageResponse<SupplierResponse>> => {
  // El filtro es el parámetro $1 en ambas consultas; límite y offset van después
  const filterParams: unknown[] = filter.active === undefined ? [] : [filter.active];
  const where = filter.active === undefined ? "" : "WHERE active = $1";
  const params: unknown[] = [...filterParams, page.limit, page.offset];
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM suppliers ${where}`, filterParams),
    db.query<SupplierRow>(`SELECT ${SUPPLIER_COLUMNS} FROM suppliers ${where} ORDER BY name LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`, params),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toSupplierResponse));
};
