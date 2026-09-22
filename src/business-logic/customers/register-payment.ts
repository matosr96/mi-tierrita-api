import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { CreatePaymentRequest, CustomerPaymentResponse } from "../../models/index";
import { lockCustomerById } from "./find-customer";

/**
 * CU-12 Registrar abono: baja el saldo de cartera y guarda el abono en la misma transacción.
 * Un abono mayor que el saldo responde 623 (la cartera nunca queda negativa).
 */
export const registerPayment = async (customerId: number, userId: number, input: CreatePaymentRequest): Promise<CustomerPaymentResponse> =>
  db.transaction(async (client) => {
    const customer = await lockCustomerById(customerId, client);
    if (customer === undefined) throw domainError(ErrorCodes.CUSTOMER_NOT_FOUND);
    if (input.amount > customer.balance + 0.000001) {
      throw domainError(ErrorCodes.PAYMENT_EXCEEDS_BALANCE, { balance: customer.balance });
    }
    const { rows } = await client.query<{ id: number; createdAt: Date }>(
      `INSERT INTO customer_payments (customer_id, user_id, amount) VALUES ($1, $2, $3) RETURNING id, created_at AS "createdAt"`,
      [customerId, userId, input.amount],
    );
    const payment = rows[0];
    if (payment === undefined) throw new Error("INSERT de abono no devolvió fila");
    const { rows: updated } = await client.query<{ balance: number }>(
      `UPDATE customers SET balance = balance - $2 WHERE id = $1 RETURNING balance`,
      [customerId, input.amount],
    );
    return {
      id: payment.id,
      customerId,
      userId,
      amount: input.amount,
      balanceAfter: updated[0]?.balance ?? 0,
      createdAt: payment.createdAt.toISOString(),
    };
  });
