import { db } from "../../data-sources/index";
import { toSupplierResponse, type CreateSupplierRequest, type SupplierResponse, type SupplierRow } from "../../models/index";
import { SUPPLIER_COLUMNS } from "./find-supplier";

export const createSupplier = async (input: CreateSupplierRequest): Promise<SupplierResponse> => {
  const { rows } = await db.query<SupplierRow>(
    `INSERT INTO suppliers (name, tax_id, phone) VALUES ($1, $2, $3) RETURNING ${SUPPLIER_COLUMNS}`,
    [input.name, input.taxId ?? null, input.phone ?? null],
  );
  const row = rows[0];
  if (row === undefined) throw new Error("INSERT de proveedor no devolvió fila");
  return toSupplierResponse(row);
};
