import { db, type Queryable } from "../../data-sources/index";
import type { ProductRow } from "../../models/index";

export const PRODUCT_COLUMNS = `
  p.id, p.name, p.sku, p.category_id AS "categoryId", c.name AS "categoryName",
  p.purchase_price AS "purchasePrice", p.sale_price AS "salePrice", p.stock, p.active,
  p.created_at AS "createdAt", p.updated_at AS "updatedAt"`;

export const PRODUCT_FROM = `FROM products p JOIN categories c ON c.id = p.category_id`;

export const findProductById = async (id: number, q: Queryable = db): Promise<ProductRow | undefined> => {
  const { rows } = await q.query<ProductRow>(`SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM} WHERE p.id = $1`, [id]);
  return rows[0];
};

/** Bloquea la fila del producto dentro de una transacción (RNF-04). */
export const lockProductById = async (id: number, q: Queryable): Promise<ProductRow | undefined> => {
  const { rows } = await q.query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} ${PRODUCT_FROM} WHERE p.id = $1 FOR UPDATE OF p`,
    [id],
  );
  return rows[0];
};
