import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import { toCustomerResponse, type CustomerResponse, type CustomerRow, type UpdateCustomerRequest } from "../../models/index";
import { CUSTOMER_COLUMNS } from "./find-customer";

export const updateCustomer = async (id: number, input: UpdateCustomerRequest): Promise<CustomerResponse> => {
  try {
    const { rows } = await db.query<CustomerRow>(
      `UPDATE customers
         SET name = COALESCE($2, name),
             document_id = COALESCE($3, document_id),
             phone = CASE WHEN $4::boolean THEN $5 ELSE phone END,
             credit_limit = COALESCE($6, credit_limit),
             active = COALESCE($7, active)
       WHERE id = $1
       RETURNING ${CUSTOMER_COLUMNS}`,
      [id, input.name ?? null, input.documentId ?? null, input.phone !== undefined, input.phone ?? null, input.creditLimit ?? null, input.active ?? null],
    );
    const row = rows[0];
    if (row === undefined) throw domainError(ErrorCodes.CUSTOMER_NOT_FOUND);
    return toCustomerResponse(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
