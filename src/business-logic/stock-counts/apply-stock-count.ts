import { ErrorCodes, domainError, todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import type { AppliedAdjustment, ApplyStockCountRequest, ApplyStockCountResponse } from "../../models/index";
import { registerBatch } from "../batches/register-batch";
import { buildAdjustmentPlan } from "./adjustment-plan";
import { assertTransition, type StockCountActor } from "./stock-count-rules";
import { getStockCount } from "./get-stock-count";
import { lockStockCount } from "./stock-count-queries";

/**
 * Aplicar el ajuste (SUBMITTED → APPLIED, solo ADMIN). Todo en una transacción con el conteo, los productos y sus
 * lotes bloqueados: la diferencia se recalcula contra el stock físico actual (contado − products.stock).
 * - Faltante: baja `quantity_remaining` de los lotes por FEFO (vencidos primero) y `products.stock` en lo mismo.
 * - Sobrante: crea un lote de ajuste con la fecha de vencimiento indicada para ese producto (713 si falta) y el último
 *   costo unitario conocido (o el precio de compra vigente), con `registerBatch`, que sube `products.stock`.
 * Cada movimiento queda en `stock_count_adjustments`; `applied_difference` guarda la diferencia aplicada por línea.
 */
export const applyStockCount = async (id: number, auth: StockCountActor, input: ApplyStockCountRequest): Promise<ApplyStockCountResponse> => {
  const expiries = new Map(input.surplusLots.map((lot) => [lot.productId, lot.expiresAt]));
  const adjustments = await db.transaction(async (client) => {
    const count = await lockStockCount(id, client);
    assertTransition(count.status, "apply", auth.role);
    const plan = await buildAdjustmentPlan(id, client, true);

    const today = todayIso();
    const issues: { path: string; productId: number; message: string }[] = [];
    for (const line of plan.lines) {
      if (line.kind !== "SURPLUS") continue;
      const expiresAt = expiries.get(line.productId);
      if (expiresAt === undefined) issues.push({ path: `expiresAt.${line.productId}`, productId: line.productId, message: "Falta la fecha de vencimiento del lote de ajuste" });
      else if (expiresAt < today) issues.push({ path: `expiresAt.${line.productId}`, productId: line.productId, message: "La fecha de vencimiento no puede ser anterior a hoy" });
    }
    if (issues.length > 0) throw domainError(ErrorCodes.STOCK_COUNT_EXPIRY_REQUIRED, issues);

    const applied: AppliedAdjustment[] = [];
    for (const line of plan.lines) {
      const batches: AppliedAdjustment["batches"] = [];
      if (line.kind === "SHORTAGE") {
        for (const take of line.deductions) {
          await client.query(`UPDATE product_batches SET quantity_remaining = quantity_remaining - $2 WHERE id = $1`, [take.productBatchId, take.quantity]);
          batches.push({ productBatchId: take.productBatchId, quantity: -take.quantity });
        }
        await client.query(`UPDATE products SET stock = stock + $2, updated_at = now() WHERE id = $1`, [line.productId, line.difference]);
      } else {
        const batch = await registerBatch(
          { productId: line.productId, quantity: line.difference, expiresAt: expiries.get(line.productId)!, unitCost: line.lastUnitCost ?? undefined },
          client,
        );
        batches.push({ productBatchId: batch.id, quantity: line.difference });
      }
      for (const b of batches) {
        await client.query(`INSERT INTO stock_count_adjustments (line_id, product_batch_id, quantity) VALUES ($1, $2, $3)`, [line.lineId, b.productBatchId, b.quantity]);
      }
      applied.push({ productId: line.productId, productName: line.productName, sku: line.sku, difference: line.difference, batches });
    }

    // Diferencia aplicada: la del plan en las líneas con ajuste y 0 en las que ya cuadraban con el stock actual.
    await client.query(`UPDATE stock_count_lines SET applied_difference = 0 WHERE count_id = $1`, [id]);
    for (const line of plan.lines) {
      await client.query(`UPDATE stock_count_lines SET applied_difference = $2 WHERE id = $1`, [line.lineId, line.difference]);
    }
    await client.query(`UPDATE stock_counts SET status = 'APPLIED', applied_at = now(), applied_by = $2 WHERE id = $1`, [id, auth.userId]);
    return applied;
  });
  return { ...(await getStockCount(id)), adjustments };
};
