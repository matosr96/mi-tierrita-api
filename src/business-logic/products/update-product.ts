import { ErrorCodes, domainError } from "../../common/index";
import { db, isForeignKeyViolation, isUniqueViolation } from "../../data-sources/index";
import { toProductResponse, type ProductResponse, type UpdateProductRequest } from "../../models/index";
import { findProductById } from "./find-product";

export const updateProduct = async (id: number, input: UpdateProductRequest): Promise<ProductResponse> => {
  try {
    const { rowCount } = await db.query(
      `UPDATE products
         SET name = COALESCE($2, name),
             sku = COALESCE($3, sku),
             category_id = COALESCE($4, category_id),
             purchase_price = COALESCE($5, purchase_price),
             sale_price = COALESCE($6, sale_price),
             active = COALESCE($7, active),
             updated_at = now()
       WHERE id = $1`,
      [id, input.name ?? null, input.sku ?? null, input.categoryId ?? null, input.purchasePrice ?? null, input.salePrice ?? null, input.active ?? null],
    );
    if ((rowCount ?? 0) === 0) throw domainError(ErrorCodes.PRODUCT_NOT_FOUND);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    if (isForeignKeyViolation(err)) throw domainError(ErrorCodes.CATEGORY_NOT_FOUND);
    throw err;
  }
  const updated = await findProductById(id);
  if (updated === undefined) throw domainError(ErrorCodes.PRODUCT_NOT_FOUND);
  return toProductResponse(updated);
};
