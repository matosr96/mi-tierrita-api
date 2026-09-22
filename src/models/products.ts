import { createValidator } from "../common/validate";

export type ProductRow = {
  id: number;
  name: string;
  sku: string;
  categoryId: number;
  categoryName: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductResponse = Omit<ProductRow, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

export const toProductResponse = (row: ProductRow): ProductResponse => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Dinero de negocio: DECIMAL(12,2) en base (RNF-03). */
export const MONEY_RULE = { min: 0, max: 9_999_999_999.99, decimals: 2 };

export type CreateProductRequest = { name: string; sku: string; categoryId: number; purchasePrice: number; salePrice: number };

export const parseCreateProduct = (body: unknown): CreateProductRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 1, max: 120 });
  const sku = v.string("sku", { min: 1, max: 40 });
  const categoryId = v.number("categoryId", { integer: true, min: 1 });
  const purchasePrice = v.number("purchasePrice", MONEY_RULE);
  const salePrice = v.number("salePrice", MONEY_RULE);
  v.done();
  return { name: name!, sku: sku!, categoryId: categoryId!, purchasePrice: purchasePrice!, salePrice: salePrice! };
};

export type UpdateProductRequest = {
  name?: string | undefined;
  sku?: string | undefined;
  categoryId?: number | undefined;
  purchasePrice?: number | undefined;
  salePrice?: number | undefined;
  active?: boolean | undefined;
};

export const parseUpdateProduct = (body: unknown): UpdateProductRequest => {
  const v = createValidator(body);
  const result: UpdateProductRequest = {
    name: v.string("name", { min: 1, max: 120 }, false),
    sku: v.string("sku", { min: 1, max: 40 }, false),
    categoryId: v.number("categoryId", { integer: true, min: 1 }, false),
    purchasePrice: v.number("purchasePrice", MONEY_RULE, false),
    salePrice: v.number("salePrice", MONEY_RULE, false),
    active: v.boolean("active", false),
  };
  if (Object.values(result).every((field) => field === undefined)) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return result;
};

export type ProductListFilter = { categoryId?: number | undefined; active?: boolean | undefined; search?: string | undefined };
