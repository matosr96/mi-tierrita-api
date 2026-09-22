import { createValidator } from "../common/validate";
import { MONEY_RULE } from "./products";

export type ProductBatchRow = {
  id: number;
  productId: number;
  productName: string;
  supplierId: number | null;
  supplierName: string | null;
  quantity: number;
  quantityRemaining: number;
  unitCost: number;
  expiresAt: string;
  createdAt: Date;
};

export type ProductBatchResponse = Omit<ProductBatchRow, "createdAt"> & { expired: boolean; daysToExpire: number; createdAt: string };

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

export const toProductBatchResponse = (row: ProductBatchRow, todayIso: string): ProductBatchResponse => {
  const daysToExpire = daysBetween(todayIso, row.expiresAt);
  return { ...row, expired: daysToExpire < 0, daysToExpire, createdAt: row.createdAt.toISOString() };
};

const QUANTITY_RULE = { integer: true, min: 1, max: 1_000_000 };

export type CreateBatchRequest = { quantity: number; expiresAt: string; unitCost?: number | undefined; supplierId?: number | undefined };

export const parseCreateBatch = (body: unknown): CreateBatchRequest => {
  const v = createValidator(body);
  const quantity = v.number("quantity", QUANTITY_RULE);
  const expiresAt = v.date("expiresAt");
  const unitCost = v.number("unitCost", MONEY_RULE, false);
  const supplierId = v.number("supplierId", { integer: true, min: 1 }, false);
  v.done();
  return { quantity: quantity!, expiresAt: expiresAt!, unitCost, supplierId };
};

/** CU-13: compra a proveedor = lote asociado al proveedor. */
export type CreatePurchaseRequest = { productId: number; quantity: number; unitCost: number; expiresAt: string };

export const parseCreatePurchase = (body: unknown): CreatePurchaseRequest => {
  const v = createValidator(body);
  const productId = v.number("productId", { integer: true, min: 1 });
  const quantity = v.number("quantity", QUANTITY_RULE);
  const unitCost = v.number("unitCost", MONEY_RULE);
  const expiresAt = v.date("expiresAt");
  v.done();
  return { productId: productId!, quantity: quantity!, unitCost: unitCost!, expiresAt: expiresAt! };
};
