import { createValidator } from "../common/validate";

export const PaymentTypes = { CASH: "CASH", CREDIT: "CREDIT" } as const;
export type PaymentType = (typeof PaymentTypes)[keyof typeof PaymentTypes];
export const ALL_PAYMENT_TYPES = [PaymentTypes.CASH, PaymentTypes.CREDIT] as const;

export const SaleStatuses = { COMPLETED: "COMPLETED", VOIDED: "VOIDED" } as const;
export type SaleStatus = (typeof SaleStatuses)[keyof typeof SaleStatuses];
export const ALL_SALE_STATUSES = [SaleStatuses.COMPLETED, SaleStatuses.VOIDED] as const;

export type SaleRow = {
  id: number;
  invoiceNumber: string;
  customerId: number | null;
  customerName: string | null;
  userId: number;
  username: string;
  paymentType: PaymentType;
  total: number;
  status: SaleStatus;
  voidedAt: Date | null;
  voidedBy: number | null;
  createdAt: Date;
};

export type SaleLineRow = { id: number; productId: number; productName: string; sku: string; quantity: number; unitPrice: number; lineTotal: number };
export type SaleLineResponse = SaleLineRow;

export type SaleResponse = Omit<SaleRow, "voidedAt" | "createdAt"> & { voidedAt: string | null; createdAt: string };
export type SaleDetailResponse = SaleResponse & { lines: SaleLineResponse[] };

export const toSaleResponse = (row: SaleRow): SaleResponse => ({
  ...row,
  voidedAt: row.voidedAt === null ? null : row.voidedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

/** RF-03.2: el cliente envía líneas (producto, cantidad); el precio y el total los pone el servidor. */
export type SaleLineRequest = { productId: number; quantity: number };
export type CreateSaleRequest = { customerId?: number | undefined; paymentType: PaymentType; lines: SaleLineRequest[] };

export const parseCreateSale = (body: unknown): CreateSaleRequest => {
  const v = createValidator(body);
  const customerId = v.number("customerId", { integer: true, min: 1 }, false);
  const paymentType = v.oneOf("paymentType", ALL_PAYMENT_TYPES, false) ?? PaymentTypes.CASH;
  const lines = v.array<SaleLineRequest>("lines", { min: 1, max: 200 }, (item) => {
    const productId = item.number("productId", { integer: true, min: 1 });
    const quantity = item.number("quantity", { integer: true, min: 1, max: 100_000 });
    return productId === undefined || quantity === undefined ? undefined : { productId, quantity };
  });
  if (paymentType === PaymentTypes.CREDIT && customerId === undefined) v.custom("customerId", "Obligatorio en una venta a crédito");
  v.done();
  return { customerId, paymentType, lines: lines! };
};

export type SaleListFilter = {
  from?: string | undefined;
  to?: string | undefined;
  customerId?: number | undefined;
  userId?: number | undefined;
  status?: SaleStatus | undefined;
};
