import { db, type Queryable } from "../../data-sources/index";
import type { SupplierRow } from "../../models/index";

export const SUPPLIER_COLUMNS = `id, name, tax_id AS "taxId", phone, active, created_at AS "createdAt"`;

export const findSupplierById = async (id: number, q: Queryable = db): Promise<SupplierRow | undefined> => {
  const { rows } = await q.query<SupplierRow>(`SELECT ${SUPPLIER_COLUMNS} FROM suppliers WHERE id = $1`, [id]);
  return rows[0];
};
