import { ErrorCodes, domainError } from "../../common/index";
import { db, isForeignKeyViolation, isUniqueViolation } from "../../data-sources/index";
import { toProductResponse, type CreateProductRequest, type ProductResponse } from "../../models/index";
import { findProductById } from "./find-product";

/** CU-05 Registrar producto: nace con stock 0; el stock solo lo mueven lotes y ventas. */
export const createProduct = async (input: CreateProductRequest): Promise<ProductResponse> => {
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO products (name, sku, category_id, purchase_price, sale_price)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.name, input.sku, input.categoryId, input.purchasePrice, input.salePrice],
    );
    const id = rows[0]?.id;
    if (id === undefined) throw new Error("INSERT de producto no devolvió id");
    const created = await findProductById(id);
    if (created === undefined) throw new Error("Producto recién creado no encontrado");
    return toProductResponse(created);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    if (isForeignKeyViolation(err)) throw domainError(ErrorCodes.CATEGORY_NOT_FOUND);
    throw err;
  }
};
