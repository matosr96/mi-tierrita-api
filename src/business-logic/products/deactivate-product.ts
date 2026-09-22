import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";

/** DELETE /products/:id — los productos tienen histórico: se desactivan, nunca se borran. */
export const deactivateProduct = async (id: number): Promise<void> => {
  const { rowCount } = await db.query(`UPDATE products SET active = FALSE, updated_at = now() WHERE id = $1`, [id]);
  if ((rowCount ?? 0) === 0) throw domainError(ErrorCodes.PRODUCT_NOT_FOUND);
};
