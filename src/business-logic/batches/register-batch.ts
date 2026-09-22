import { ErrorCodes, domainError, todayIso } from "../../common/index";
import { db, isForeignKeyViolation } from "../../data-sources/index";
import { toProductBatchResponse, type ProductBatchResponse, type ProductBatchRow } from "../../models/index";
import { lockProductById } from "../products/find-product";
import { BATCH_COLUMNS, BATCH_FROM } from "./batch-queries";

export type RegisterBatchInput = {
  productId: number;
  quantity: number;
  expiresAt: string;
  unitCost?: number | undefined;
  supplierId?: number | undefined;
};

/**
 * CU-06 Registrar lote (y CU-13 compra a proveedor): crea el lote y aumenta el stock del
 * producto en la misma transacción, con la fila del producto bloqueada.
 * Si no se indica costo unitario se usa el precio de compra vigente del producto.
 */
export const registerBatch = async (input: RegisterBatchInput): Promise<ProductBatchResponse> =>
  db.transaction(async (client) => {
    const product = await lockProductById(input.productId, client);
    if (product === undefined) throw domainError(ErrorCodes.PRODUCT_NOT_FOUND);
    if (!product.active) throw domainError(ErrorCodes.PRODUCT_INACTIVE);

    let batchId: number | undefined;
    try {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO product_batches (product_id, supplier_id, quantity, quantity_remaining, unit_cost, expires_at)
         VALUES ($1, $2, $3, $3, $4, $5) RETURNING id`,
        [input.productId, input.supplierId ?? null, input.quantity, input.unitCost ?? product.purchasePrice, input.expiresAt],
      );
      batchId = rows[0]?.id;
    } catch (err) {
      if (isForeignKeyViolation(err)) throw domainError(ErrorCodes.SUPPLIER_NOT_FOUND);
      throw err;
    }
    await client.query(`UPDATE products SET stock = stock + $2, updated_at = now() WHERE id = $1`, [input.productId, input.quantity]);

    const { rows } = await client.query<ProductBatchRow>(`SELECT ${BATCH_COLUMNS} ${BATCH_FROM} WHERE b.id = $1`, [batchId]);
    const batch = rows[0];
    if (batch === undefined) throw new Error("Lote recién creado no encontrado");
    return toProductBatchResponse(batch, todayIso());
  });
