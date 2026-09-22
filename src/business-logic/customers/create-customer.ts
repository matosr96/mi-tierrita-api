import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import { toCustomerResponse, type CreateCustomerRequest, type CustomerResponse, type CustomerRow } from "../../models/index";
import { CUSTOMER_COLUMNS } from "./find-customer";

/** RF-04.1: documento duplicado responde 630. */
export const createCustomer = async (input: CreateCustomerRequest): Promise<CustomerResponse> => {
  try {
    const { rows } = await db.query<CustomerRow>(
      `INSERT INTO customers (name, document_id, phone, credit_limit)
       VALUES ($1, $2, $3, $4) RETURNING ${CUSTOMER_COLUMNS}`,
      [input.name, input.documentId, input.phone ?? null, input.creditLimit ?? 0],
    );
    const row = rows[0];
    if (row === undefined) throw new Error("INSERT de cliente no devolvió fila");
    return toCustomerResponse(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
