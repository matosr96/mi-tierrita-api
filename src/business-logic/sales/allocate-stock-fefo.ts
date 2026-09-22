import { ErrorCodes, domainError, todayIso } from "../../common/index";
import type { Queryable } from "../../data-sources/index";

export type BatchAllocation = { productBatchId: number; quantity: number };

type AvailableBatch = { id: number; quantityRemaining: number };

/**
 * CU-08 Descontar stock por venta (FEFO): toma los lotes del producto con existencias,
 * no vencidos, ordenados por fecha de vencimiento ascendente, y descuenta hasta cubrir la
 * cantidad. Debe llamarse con la fila del producto ya bloqueada (RNF-04).
 * Si no alcanza entre todos los lotes → 620 y la venta completa se revierte.
 */
export const allocateStockFefo = async (
  productId: number,
  quantity: number,
  q: Queryable,
): Promise<BatchAllocation[]> => {
  const { rows: batches } = await q.query<AvailableBatch>(
    `SELECT id, quantity_remaining AS "quantityRemaining"
     FROM product_batches
     WHERE product_id = $1 AND quantity_remaining > 0 AND expires_at >= $2
     ORDER BY expires_at, id
     FOR UPDATE`,
    [productId, todayIso()],
  );

  const available = batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
  if (available < quantity) {
    throw domainError(ErrorCodes.STOCK_INSUFFICIENT, { productId, requested: quantity, available });
  }

  const allocations: BatchAllocation[] = [];
  let pending = quantity;
  for (const batch of batches) {
    if (pending === 0) break;
    const take = Math.min(batch.quantityRemaining, pending);
    await q.query(`UPDATE product_batches SET quantity_remaining = quantity_remaining - $2 WHERE id = $1`, [batch.id, take]);
    allocations.push({ productBatchId: batch.id, quantity: take });
    pending -= take;
  }
  await q.query(`UPDATE products SET stock = stock - $2, updated_at = now() WHERE id = $1`, [productId, quantity]);
  return allocations;
};
