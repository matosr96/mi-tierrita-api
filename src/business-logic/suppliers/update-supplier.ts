import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toSupplierResponse, type SupplierResponse, type SupplierRow, type UpdateSupplierRequest } from "../../models/index";
import { SUPPLIER_COLUMNS } from "./find-supplier";

export const updateSupplier = async (id: number, input: UpdateSupplierRequest): Promise<SupplierResponse> => {
  // taxId/phone admiten null explícito para borrar el dato; undefined conserva el actual
  const { rows } = await db.query<SupplierRow>(
    `UPDATE suppliers
       SET name = COALESCE($2, name),
           tax_id = CASE WHEN $3::boolean THEN $4 ELSE tax_id END,
           phone = CASE WHEN $5::boolean THEN $6 ELSE phone END,
           active = COALESCE($7, active)
     WHERE id = $1
     RETURNING ${SUPPLIER_COLUMNS}`,
    [id, input.name ?? null, input.taxId !== undefined, input.taxId ?? null, input.phone !== undefined, input.phone ?? null, input.active ?? null],
  );
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.SUPPLIER_NOT_FOUND);
  return toSupplierResponse(row);
};
