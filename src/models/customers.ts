import { createValidator } from "../common/validate";
import { MONEY_RULE } from "./products";

export type CustomerRow = {
  id: number;
  name: string;
  documentId: string;
  phone: string | null;
  creditLimit: number;
  balance: number;
  active: boolean;
  createdAt: Date;
};

export type CustomerResponse = Omit<CustomerRow, "createdAt"> & { availableCredit: number; createdAt: string };

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const toCustomerResponse = (row: CustomerRow): CustomerResponse => ({
  ...row,
  availableCredit: round2(Math.max(row.creditLimit - row.balance, 0)),
  createdAt: row.createdAt.toISOString(),
});

export type CreateCustomerRequest = { name: string; documentId: string; phone?: string | undefined; creditLimit?: number | undefined };

export const parseCreateCustomer = (body: unknown): CreateCustomerRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 120 });
  const documentId = v.string("documentId", { min: 3, max: 30 });
  const phone = v.string("phone", { max: 30 }, false);
  const creditLimit = v.number("creditLimit", MONEY_RULE, false);
  v.done();
  return { name: name!, documentId: documentId!, phone, creditLimit };
};

export type UpdateCustomerRequest = {
  name?: string | undefined;
  documentId?: string | undefined;
  phone?: string | null | undefined;
  creditLimit?: number | undefined;
  active?: boolean | undefined;
};

export const parseUpdateCustomer = (body: unknown): UpdateCustomerRequest => {
  const v = createValidator(body);
  const result: UpdateCustomerRequest = {
    name: v.string("name", { min: 1, max: 120 }, false),
    documentId: v.string("documentId", { min: 3, max: 30 }, false),
    phone: v.isNull("phone") ? null : v.string("phone", { max: 30 }, false),
    creditLimit: v.number("creditLimit", MONEY_RULE, false),
    active: v.boolean("active", false),
  };
  if (Object.values(result).every((field) => field === undefined)) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return result;
};

export type CustomerBalanceResponse = {
  customerId: number;
  name: string;
  creditLimit: number;
  balance: number;
  availableCredit: number;
  lastCreditSaleAt: string | null;
  lastPaymentAt: string | null;
  overdue: boolean;
  overdueDays: number;
};

export type CreatePaymentRequest = { amount: number };

export const parseCreatePayment = (body: unknown): CreatePaymentRequest => {
  const v = createValidator(body);
  const amount = v.number("amount", { ...MONEY_RULE, min: 0.01 });
  v.done();
  return { amount: amount! };
};

export type CustomerPaymentResponse = { id: number; customerId: number; userId: number; amount: number; balanceAfter: number; createdAt: string };
