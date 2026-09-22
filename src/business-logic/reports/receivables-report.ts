import { db } from "../../data-sources/index";
import { BALANCE_SELECT } from "../customers/get-customer-balance";

export type ReceivableRow = {
  customerId: number;
  name: string;
  creditLimit: number;
  balance: number;
  lastCreditSaleAt: string | null;
  lastPaymentAt: string | null;
  overdue: boolean;
};

export type ReceivablesReport = {
  overdueDays: number;
  customersWithBalance: number;
  totalBalance: number;
  overdueCustomers: number;
  overdueBalance: number;
  items: ReceivableRow[];
};

type Row = { id: number; name: string; creditLimit: number; balance: number; lastCreditSaleAt: Date | null; lastPaymentAt: Date | null; overdue: boolean };

/** CU-20 / RF-08.3 Cartera: clientes con saldo y cartera vencida (ver supuesto en get-customer-balance). */
export const receivablesReport = async (overdueDays: number): Promise<ReceivablesReport> => {
  const { rows } = await db.query<Row>(`${BALANCE_SELECT} WHERE c.balance > 0 ORDER BY c.balance DESC, c.name`, [overdueDays]);
  const round2 = (n: number): number => Math.round(n * 100) / 100;
  const items = rows.map((r) => ({
    customerId: r.id,
    name: r.name,
    creditLimit: r.creditLimit,
    balance: r.balance,
    lastCreditSaleAt: r.lastCreditSaleAt === null ? null : r.lastCreditSaleAt.toISOString(),
    lastPaymentAt: r.lastPaymentAt === null ? null : r.lastPaymentAt.toISOString(),
    overdue: r.overdue,
  }));
  const overdueItems = items.filter((i) => i.overdue);
  return {
    overdueDays,
    customersWithBalance: items.length,
    totalBalance: round2(items.reduce((sum, i) => sum + i.balance, 0)),
    overdueCustomers: overdueItems.length,
    overdueBalance: round2(overdueItems.reduce((sum, i) => sum + i.balance, 0)),
    items,
  };
};
