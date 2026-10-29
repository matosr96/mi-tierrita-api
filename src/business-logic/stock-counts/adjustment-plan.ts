import { isDomainError, todayIso } from "../../common/index";
import type { Queryable } from "../../data-sources/index";
import type { AdjustmentPreviewLine, AdjustmentPreviewResponse, StockCountStatus } from "../../models/index";
import { planFefoShortage, type ShortageBatch } from "./plan-fefo-shortage";

type PlanLineRow = {
  lineId: number;
  productId: number;
  productName: string;
  sku: string;
  expectedQuantity: number;
  countedQuantity: number;
  currentStock: number;
};

export type PlannedLine = AdjustmentPreviewLine & { lineId: number };

/**
 * Ajuste que se aplicaría hoy: por cada línea contada, diferencia = contado − stock físico ACTUAL (no la foto del
 * inicio: si hubo ventas o compras entre iniciar y aplicar, cuenta lo que hay ahora). Solo devuelve las líneas con
 * diferencia distinta de cero. Con `lock`, bloquea productos (en orden de id) y sus lotes: lo usa `applyStockCount`
 * dentro de su transacción; la vista previa lo llama sin bloquear.
 */
export const buildAdjustmentPlan = async (countId: number, q: Queryable, lock: boolean): Promise<{ lines: PlannedLine[]; unchangedLines: number; changedSinceStart: number }> => {
  const { rows } = await q.query<PlanLineRow>(
    `SELECT l.id AS "lineId", l.product_id AS "productId", p.name AS "productName", p.sku,
            l.expected_quantity AS "expectedQuantity", l.counted_quantity AS "countedQuantity", p.stock AS "currentStock"
     FROM stock_count_lines l
     JOIN products p ON p.id = l.product_id
     WHERE l.count_id = $1 AND l.counted_quantity IS NOT NULL
     ORDER BY p.id
     ${lock ? "FOR UPDATE OF p, l" : ""}`,
    [countId],
  );
  const today = todayIso();
  const lines: PlannedLine[] = [];
  let unchangedLines = 0;
  let changedSinceStart = 0;
  for (const row of rows) {
    if (row.currentStock !== row.expectedQuantity) changedSinceStart += 1;
    const difference = row.countedQuantity - row.currentStock;
    if (difference === 0) {
      unchangedLines += 1;
      continue;
    }
    const base = {
      lineId: row.lineId,
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      expectedQuantity: row.expectedQuantity,
      countedQuantity: row.countedQuantity,
      currentStock: row.currentStock,
      difference,
      stockChangedSinceStart: row.currentStock !== row.expectedQuantity,
    };
    if (difference < 0) {
      const { rows: batches } = await q.query<ShortageBatch>(
        `SELECT id, quantity_remaining AS "quantityRemaining", expires_at AS "expiresAt"
         FROM product_batches WHERE product_id = $1 AND quantity_remaining > 0
         ORDER BY expires_at, id ${lock ? "FOR UPDATE" : ""}`,
        [row.productId],
      );
      let deductions: PlannedLine["deductions"] = [];
      let exceedsStock = false;
      try {
        deductions = planFefoShortage(batches, -difference, today);
      } catch (err) {
        // En la aplicación el error sube (714); en la vista previa se marca la línea.
        if (lock || !isDomainError(err)) throw err;
        exceedsStock = true;
      }
      lines.push({ ...base, kind: "SHORTAGE", deductions, exceedsStock, lastUnitCost: null, needsExpiry: false });
    } else {
      const { rows: costs } = await q.query<{ unitCost: number }>(
        `SELECT unit_cost AS "unitCost" FROM product_batches WHERE product_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
        [row.productId],
      );
      lines.push({ ...base, kind: "SURPLUS", deductions: [], exceedsStock: false, lastUnitCost: costs[0]?.unitCost ?? null, needsExpiry: true });
    }
  }
  return { lines, unchangedLines, changedSinceStart };
};

export const toPreviewResponse = (
  countId: number,
  status: StockCountStatus,
  plan: { lines: PlannedLine[]; unchangedLines: number; changedSinceStart: number },
): AdjustmentPreviewResponse => {
  const shortage = plan.lines.filter((l) => l.kind === "SHORTAGE");
  const surplus = plan.lines.filter((l) => l.kind === "SURPLUS");
  return {
    countId,
    status,
    lines: plan.lines.map(({ lineId: _lineId, ...line }) => line),
    summary: {
      shortageLines: shortage.length,
      surplusLines: surplus.length,
      shortageUnits: shortage.reduce((sum, l) => sum - l.difference, 0),
      surplusUnits: surplus.reduce((sum, l) => sum + l.difference, 0),
      unchangedLines: plan.unchangedLines,
      changedSinceStart: plan.changedSinceStart,
    },
  };
};
