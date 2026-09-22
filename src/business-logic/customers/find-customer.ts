import { db, type Queryable } from "../../data-sources/index";
import type { CustomerRow } from "../../models/index";

export const CUSTOMER_COLUMNS = `
  id, name, document_id AS "documentId", phone, credit_limit AS "creditLimit",
  balance, active, created_at AS "createdAt"`;

export const findCustomerById = async (id: number, q: Queryable = db): Promise<CustomerRow | undefined> => {
  const { rows } = await q.query<CustomerRow>(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1`, [id]);
  return rows[0];
};

/** Bloquea la fila del cliente dentro de una transacción (cupo y saldo consistentes). */
export const lockCustomerById = async (id: number, q: Queryable): Promise<CustomerRow | undefined> => {
  const { rows } = await q.query<CustomerRow>(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0];
};
