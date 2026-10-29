import { ErrorCodes, domainError, todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import type { CreateStockCountRequest, StockCountDetailResponse } from "../../models/index";
import { getStockCount } from "./get-stock-count";

/** Programar un conteo (PLANNED): fecha de hoy en adelante y alcance todo el inventario o una categoría activa. */
export const createStockCount = async (userId: number, input: CreateStockCountRequest): Promise<StockCountDetailResponse> => {
  if (input.scheduledDate < todayIso()) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "scheduledDate", message: "La fecha no puede ser anterior a hoy" }]);
  }
  if (input.categoryId !== null) {
    const { rows } = await db.query<{ active: boolean }>(`SELECT active FROM categories WHERE id = $1`, [input.categoryId]);
    const category = rows[0];
    if (category === undefined) throw domainError(ErrorCodes.CATEGORY_NOT_FOUND);
    if (!category.active) throw domainError(ErrorCodes.VALIDATION, [{ path: "categoryId", message: "La categoría está inactiva" }]);
  }
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO stock_counts (title, scheduled_date, scope, category_id, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.title, input.scheduledDate, input.scope, input.categoryId, input.note, userId],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("INSERT de conteo no devolvió id");
  return getStockCount(id);
};
