import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { CustomerBalanceResponse } from "../../models/index";

export const DEFAULT_OVERDUE_DAYS = 30;

type BalanceRow = {
  id: number;
  name: string;
  creditLimit: number;
  balance: number;
  lastCreditSaleAt: Date | null;
  lastPaymentAt: Date | null;
  overdue: boolean;
};

/**
 * RF-04.4 Saldo de cartera. Cartera vencida (supuesto documentado en el README): saldo mayor
 * que cero cuya última venta a crédito tiene más de `overdueDays` días (30 por defecto).
 */
export const BALANCE_SELECT = `
  SELECT c.id, c.name, c.credit_limit AS "creditLimit", c.balance,
         ls.last_credit_sale_at AS "lastCreditSaleAt",
         lp.last_payment_at AS "lastPaymentAt",
         (c.balance > 0 AND ls.last_credit_sale_at IS NOT NULL
            AND ls.last_credit_sale_at < now() - make_interval(days => $1)) AS overdue
  FROM customers c
  LEFT JOIN LATERAL (
    SELECT max(s.created_at) AS last_credit_sale_at FROM sales s
    WHERE s.customer_id = c.id AND s.payment_type = 'CREDIT' AND s.status = 'COMPLETED'
  ) ls ON TRUE
  LEFT JOIN LATERAL (
    SELECT max(p.created_at) AS last_payment_at FROM customer_payments p WHERE p.customer_id = c.id
  ) lp ON TRUE`;

export const getCustomerBalance = async (id: number, overdueDays = DEFAULT_OVERDUE_DAYS): Promise<CustomerBalanceResponse> => {
  const { rows } = await db.query<BalanceRow>(`${BALANCE_SELECT} WHERE c.id = $2`, [overdueDays, id]);
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.CUSTOMER_NOT_FOUND);
  return {
    customerId: row.id,
    name: row.name,
    creditLimit: row.creditLimit,
    balance: row.balance,
    availableCredit: Math.round(Math.max(row.creditLimit - row.balance, 0) * 100) / 100,
    lastCreditSaleAt: row.lastCreditSaleAt === null ? null : row.lastCreditSaleAt.toISOString(),
    lastPaymentAt: row.lastPaymentAt === null ? null : row.lastPaymentAt.toISOString(),
    overdue: row.overdue,
    overdueDays,
  };
};
