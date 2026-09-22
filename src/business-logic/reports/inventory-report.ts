import { addDaysIso, todayIso } from "../../common/index";
import { db } from "../../data-sources/index";

export type InventoryCategoryRow = { categoryId: number; categoryName: string; products: number; units: number; costValue: number; saleValue: number };

export type InventoryReport = {
  asOf: string;
  expiringDays: number;
  products: number;
  activeProducts: number;
  units: number;
  /** Inventario valorizado al costo de cada lote (unidades restantes × costo unitario). */
  costValue: number;
  /** Valor a precio de venta vigente (stock × precio de venta). */
  saleValue: number;
  outOfStock: number;
  expiringSoon: { batches: number; units: number; costValue: number };
  expired: { batches: number; units: number; costValue: number };
  byCategory: InventoryCategoryRow[];
};

/** CU-20 / RF-08.2 Inventario valorizado y lotes por vencer, agregado en la base. */
export const inventoryReport = async (expiringDays: number): Promise<InventoryReport> => {
  const asOf = todayIso();
  const limitDate = addDaysIso(asOf, expiringDays);

  const [{ rows: productRows }, { rows: batchRows }, { rows: byCategory }] = await Promise.all([
    db.query<{ products: number; activeProducts: number; units: number; saleValue: number; outOfStock: number }>(
      `SELECT count(*)::int AS products,
              count(*) FILTER (WHERE active)::int AS "activeProducts",
              COALESCE(sum(stock), 0)::int AS units,
              COALESCE(sum(stock * sale_price), 0) AS "saleValue",
              count(*) FILTER (WHERE active AND stock = 0)::int AS "outOfStock"
       FROM products`,
    ),
    db.query<{ costValue: number; expiringBatches: number; expiringUnits: number; expiringCost: number; expiredBatches: number; expiredUnits: number; expiredCost: number }>(
      `SELECT COALESCE(sum(quantity_remaining * unit_cost), 0) AS "costValue",
              count(*) FILTER (WHERE expires_at >= $1 AND expires_at <= $2)::int AS "expiringBatches",
              COALESCE(sum(quantity_remaining) FILTER (WHERE expires_at >= $1 AND expires_at <= $2), 0)::int AS "expiringUnits",
              COALESCE(sum(quantity_remaining * unit_cost) FILTER (WHERE expires_at >= $1 AND expires_at <= $2), 0) AS "expiringCost",
              count(*) FILTER (WHERE expires_at < $1)::int AS "expiredBatches",
              COALESCE(sum(quantity_remaining) FILTER (WHERE expires_at < $1), 0)::int AS "expiredUnits",
              COALESCE(sum(quantity_remaining * unit_cost) FILTER (WHERE expires_at < $1), 0) AS "expiredCost"
       FROM product_batches WHERE quantity_remaining > 0`,
      [asOf, limitDate],
    ),
    db.query<InventoryCategoryRow>(
      `SELECT c.id AS "categoryId", c.name AS "categoryName",
              count(p.id)::int AS products,
              COALESCE(sum(p.stock), 0)::int AS units,
              COALESCE((SELECT sum(b.quantity_remaining * b.unit_cost) FROM product_batches b JOIN products pp ON pp.id = b.product_id WHERE pp.category_id = c.id), 0) AS "costValue",
              COALESCE(sum(p.stock * p.sale_price), 0) AS "saleValue"
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id, c.name ORDER BY c.name`,
    ),
  ]);
  const p = productRows[0] ?? { products: 0, activeProducts: 0, units: 0, saleValue: 0, outOfStock: 0 };
  const b = batchRows[0] ?? { costValue: 0, expiringBatches: 0, expiringUnits: 0, expiringCost: 0, expiredBatches: 0, expiredUnits: 0, expiredCost: 0 };
  return {
    asOf,
    expiringDays,
    products: p.products,
    activeProducts: p.activeProducts,
    units: p.units,
    costValue: b.costValue,
    saleValue: p.saleValue,
    outOfStock: p.outOfStock,
    expiringSoon: { batches: b.expiringBatches, units: b.expiringUnits, costValue: b.expiringCost },
    expired: { batches: b.expiredBatches, units: b.expiredUnits, costValue: b.expiredCost },
    byCategory,
  };
};
