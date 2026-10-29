import { ErrorCodes, domainError } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import type { StockCountLineResponse, StockCountRow, StockCountSummary } from "../../models/index";

const userName = (alias: string): string => `NULLIF(concat_ws(' ', ${alias}.first_name, ${alias}.last_name), '')`;

export const STOCK_COUNT_COLUMNS = `
  sc.id, sc.title, sc.scheduled_date AS "scheduledDate", sc.scope, sc.category_id AS "categoryId",
  c.name AS "categoryName", sc.status, sc.note,
  sc.created_by AS "createdBy", ${userName("uc")} AS "createdByName",
  sc.started_at AS "startedAt", sc.started_by AS "startedBy", ${userName("us")} AS "startedByName",
  sc.submitted_at AS "submittedAt", sc.submitted_by AS "submittedBy", ${userName("ub")} AS "submittedByName",
  sc.applied_at AS "appliedAt", sc.applied_by AS "appliedBy", ${userName("ua")} AS "appliedByName",
  sc.cancelled_at AS "cancelledAt", sc.cancelled_by AS "cancelledBy", ${userName("ux")} AS "cancelledByName",
  sc.created_at AS "createdAt",
  (SELECT count(*)::int FROM stock_count_lines l WHERE l.count_id = sc.id) AS "totalLines",
  (SELECT count(*)::int FROM stock_count_lines l WHERE l.count_id = sc.id AND l.counted_quantity IS NOT NULL) AS "countedLines"`;

export const STOCK_COUNT_FROM = `
  FROM stock_counts sc
  LEFT JOIN categories c ON c.id = sc.category_id
  JOIN users uc ON uc.id = sc.created_by
  LEFT JOIN users us ON us.id = sc.started_by
  LEFT JOIN users ub ON ub.id = sc.submitted_by
  LEFT JOIN users ua ON ua.id = sc.applied_by
  LEFT JOIN users ux ON ux.id = sc.cancelled_by`;

export const findStockCountById = async (id: number, q: Queryable = db): Promise<StockCountRow | undefined> => {
  const { rows } = await q.query<StockCountRow>(`SELECT ${STOCK_COUNT_COLUMNS} ${STOCK_COUNT_FROM} WHERE sc.id = $1`, [id]);
  return rows[0];
};

/** Bloquea la fila del conteo dentro de una transacción (dos personas no pueden iniciar o aplicar el mismo a la vez). */
export const lockStockCount = async (id: number, q: Queryable): Promise<{ id: number; status: StockCountRow["status"]; scope: StockCountRow["scope"]; categoryId: number | null }> => {
  const { rows } = await q.query<{ id: number; status: StockCountRow["status"]; scope: StockCountRow["scope"]; categoryId: number | null }>(
    `SELECT id, status, scope, category_id AS "categoryId" FROM stock_counts WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.STOCK_COUNT_NOT_FOUND);
  return row;
};

export const findStockCountLines = async (countId: number, q: Queryable = db): Promise<StockCountLineResponse[]> => {
  const { rows } = await q.query<StockCountLineResponse>(
    `SELECT l.id, l.product_id AS "productId", p.name AS "productName", p.sku, c.name AS "categoryName",
            l.expected_quantity AS "expectedQuantity", l.counted_quantity AS "countedQuantity", l.difference,
            l.applied_difference AS "appliedDifference", l.note
     FROM stock_count_lines l
     JOIN products p ON p.id = l.product_id
     JOIN categories c ON c.id = p.category_id
     WHERE l.count_id = $1
     ORDER BY p.name, p.id`,
    [countId],
  );
  return rows;
};

/** Resumen del conteo contra la foto del inicio (lo que la app muestra tal cual). */
export const summarizeLines = (lines: readonly Pick<StockCountLineResponse, "countedQuantity" | "difference">[]): StockCountSummary => {
  const counted = lines.filter((l) => l.countedQuantity !== null);
  return {
    totalLines: lines.length,
    countedLines: counted.length,
    pendingLines: lines.length - counted.length,
    linesWithDifference: counted.filter((l) => (l.difference ?? 0) !== 0).length,
    shortageUnits: counted.reduce((sum, l) => sum + Math.max(0, -(l.difference ?? 0)), 0),
    surplusUnits: counted.reduce((sum, l) => sum + Math.max(0, l.difference ?? 0), 0),
  };
};
