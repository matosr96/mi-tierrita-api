import { ErrorCodes, domainError } from "../../common/index";

export type ShortageBatch = { id: number; quantityRemaining: number; expiresAt: string };
export type ShortageTake = { productBatchId: number; expiresAt: string; expired: boolean; quantity: number };

/**
 * De qué lotes salen las unidades faltantes de un conteo: primero los vencidos (son los que más probablemente ya no
 * están en bodega), luego por fecha de vencimiento ascendente y, a igual fecha, el lote más antiguo. A diferencia de la
 * venta (CU-08), aquí sí cuentan los lotes vencidos. Si entre todos los lotes no alcanza → 714.
 */
export const planFefoShortage = (batches: readonly ShortageBatch[], units: number, today: string): ShortageTake[] => {
  if (units <= 0) return [];
  const ordered = batches
    .filter((b) => b.quantityRemaining > 0)
    .map((b) => ({ ...b, expired: b.expiresAt < today }))
    .sort((a, b) => Number(b.expired) - Number(a.expired) || a.expiresAt.localeCompare(b.expiresAt) || a.id - b.id);
  const available = ordered.reduce((sum, b) => sum + b.quantityRemaining, 0);
  if (available < units) throw domainError(ErrorCodes.STOCK_COUNT_SHORTAGE_EXCEEDS_STOCK, { requested: units, available });

  const takes: ShortageTake[] = [];
  let pending = units;
  for (const batch of ordered) {
    if (pending === 0) break;
    const quantity = Math.min(batch.quantityRemaining, pending);
    takes.push({ productBatchId: batch.id, expiresAt: batch.expiresAt, expired: batch.expired, quantity });
    pending -= quantity;
  }
  return takes;
};
