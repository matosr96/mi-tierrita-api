import { addDaysIso, todayIso } from "../../common/index";
import { db } from "../../data-sources/index";
import type { Role } from "../../security/index";

/**
 * Recomendaciones del día calculadas en la base, sin IA: la IA solo las explica y prioriza (briefing y asistente).
 * Cada una trae sus cifras y el porqué, para que se pueda revisar.
 *  - restock: al ritmo de venta de los últimos 30 días, lo vendible alcanza para menos de RESTOCK_DAYS días.
 *  - rotate: un lote que vence en ROTATE_WINDOW días y, al ritmo actual, no alcanza a venderse completo (FEFO).
 *  - collect: clientes con saldo, primero la cartera vencida y los que más cupo usan.
 *  - idle: productos con existencias que no se venden hace IDLE_DAYS días (capital quieto).
 */
export const RESTOCK_DAYS = 10;
export const ROTATE_WINDOW = 45;
export const IDLE_DAYS = 60;
const SALES_WINDOW = 30;

export type Insight =
  | { kind: "restock"; productId: number; productName: string; sku: string; available: number; dailyAvg: number; coverDays: number; suggestedQty: number }
  | { kind: "rotate"; batchId: number; productId: number; productName: string; expiresAt: string; daysToExpire: number; remaining: number; projectedSold: number; surplus: number; surplusCost: number }
  | { kind: "collect"; customerId: number; name: string; phone: string | null; balance: number; creditLimit: number; usedPct: number; overdue: boolean; daysSincePayment: number | null }
  | { kind: "idle"; productId: number; productName: string; sku: string; available: number; costValue: number; lastSaleAt: string | null };

const KINDS_BY_ROLE: Record<Role, Insight["kind"][]> = {
  ADMIN: ["restock", "rotate", "collect", "idle"],
  SALES: ["collect"],
  WAREHOUSE: ["restock", "rotate", "idle"],
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

type ProductStat = { id: number; name: string; sku: string; available: number; purchasePrice: number; sold30: number; lastSaleAt: Date | null };
type BatchRow = { id: number; productId: number; expiresAt: string; remaining: number; unitCost: number };
type CustomerRow = { id: number; name: string; phone: string | null; balance: number; creditLimit: number; lastPaymentAt: Date | null; lastCreditSaleAt: Date | null };

const productStats = async (): Promise<ProductStat[]> => {
  const { rows } = await db.query<ProductStat>(
    `SELECT p.id, p.name, p.sku, p.purchase_price AS "purchasePrice",
            (SELECT COALESCE(sum(b.quantity_remaining), 0)::int FROM product_batches b
              WHERE b.product_id = p.id AND b.quantity_remaining > 0 AND b.expires_at >= CURRENT_DATE) AS available,
            COALESCE((SELECT sum(l.quantity)::int FROM sale_lines l JOIN sales s ON s.id = l.sale_id
              WHERE l.product_id = p.id AND s.status = 'COMPLETED' AND s.created_at >= CURRENT_DATE - $1::int), 0) AS "sold30",
            (SELECT max(s.created_at) FROM sale_lines l JOIN sales s ON s.id = l.sale_id
              WHERE l.product_id = p.id AND s.status = 'COMPLETED') AS "lastSaleAt"
     FROM products p WHERE p.active`,
    [SALES_WINDOW],
  );
  return rows;
};

const restock = (stats: ProductStat[]): Insight[] =>
  stats
    .filter((p) => p.sold30 > 0)
    .map((p) => {
      const dailyAvg = p.sold30 / SALES_WINDOW;
      const coverDays = p.available / dailyAvg;
      return { p, dailyAvg, coverDays };
    })
    .filter((x) => x.coverDays < RESTOCK_DAYS)
    .sort((a, b) => a.coverDays - b.coverDays)
    .map(({ p, dailyAvg, coverDays }) => ({
      kind: "restock" as const,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      available: p.available,
      dailyAvg: round1(dailyAvg),
      coverDays: round1(coverDays),
      // Para cubrir un mes al ritmo actual
      suggestedQty: Math.max(1, Math.ceil(dailyAvg * SALES_WINDOW - p.available)),
    }));

const rotate = async (stats: ProductStat[], today: string): Promise<Insight[]> => {
  const { rows } = await db.query<BatchRow>(
    `SELECT id, product_id AS "productId", expires_at AS "expiresAt", quantity_remaining AS remaining, unit_cost AS "unitCost"
     FROM product_batches
     WHERE quantity_remaining > 0 AND expires_at >= CURRENT_DATE AND expires_at <= CURRENT_DATE + $1::int
     ORDER BY product_id, expires_at, id`,
    [ROTATE_WINDOW],
  );
  const byId = new Map(stats.map((p) => [p.id, p]));
  const out: Insight[] = [];
  // FEFO: por producto, los lotes salen en orden de vencimiento; lo que se vende antes de cada fecha se reparte en orden.
  let current = -1;
  let consumed = 0;
  for (const b of rows) {
    if (b.productId !== current) {
      current = b.productId;
      consumed = 0;
    }
    const p = byId.get(b.productId);
    if (!p) continue;
    const days = daysBetween(today, b.expiresAt);
    const sellableByThen = (p.sold30 / SALES_WINDOW) * Math.max(days, 0);
    const forThisBatch = Math.max(0, Math.min(b.remaining, sellableByThen - consumed));
    consumed += b.remaining;
    const surplus = Math.round(b.remaining - forThisBatch);
    if (surplus <= 0) continue;
    out.push({
      kind: "rotate",
      batchId: b.id,
      productId: p.id,
      productName: p.name,
      expiresAt: b.expiresAt,
      daysToExpire: days,
      remaining: b.remaining,
      projectedSold: Math.round(forThisBatch),
      surplus,
      surplusCost: Math.round(surplus * b.unitCost),
    });
  }
  return out.sort((a, b) => (a.kind === "rotate" && b.kind === "rotate" ? b.surplusCost - a.surplusCost : 0));
};

const collect = async (today: string): Promise<Insight[]> => {
  const { rows } = await db.query<CustomerRow>(
    `SELECT c.id, c.name, c.phone, c.balance, c.credit_limit AS "creditLimit",
            (SELECT max(p.created_at) FROM customer_payments p WHERE p.customer_id = c.id) AS "lastPaymentAt",
            (SELECT max(s.created_at) FROM sales s WHERE s.customer_id = c.id AND s.payment_type = 'CREDIT' AND s.status = 'COMPLETED') AS "lastCreditSaleAt"
     FROM customers c WHERE c.active AND c.balance > 0`,
  );
  const overdueSince = addDaysIso(today, -30);
  return rows
    .map((c) => {
      const lastMove = c.lastPaymentAt ?? c.lastCreditSaleAt;
      const lastIso = lastMove ? lastMove.toISOString().slice(0, 10) : null;
      const overdue = lastIso !== null && lastIso < overdueSince;
      return {
        kind: "collect" as const,
        customerId: c.id,
        name: c.name,
        phone: c.phone,
        balance: c.balance,
        creditLimit: c.creditLimit,
        usedPct: c.creditLimit > 0 ? Math.round((c.balance / c.creditLimit) * 100) : 100,
        overdue,
        daysSincePayment: c.lastPaymentAt ? daysBetween(c.lastPaymentAt.toISOString().slice(0, 10), today) : null,
      };
    })
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.usedPct - a.usedPct || b.balance - a.balance);
};

const idle = (stats: ProductStat[], today: string): Insight[] => {
  const cutoff = addDaysIso(today, -IDLE_DAYS);
  return stats
    .filter((p) => p.available > 0 && (p.lastSaleAt === null || p.lastSaleAt.toISOString().slice(0, 10) < cutoff))
    .map((p) => ({
      kind: "idle" as const,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      available: p.available,
      costValue: Math.round(p.available * p.purchasePrice),
      lastSaleAt: p.lastSaleAt ? p.lastSaleAt.toISOString() : null,
    }))
    .sort((a, b) => b.costValue - a.costValue);
};

/** Recomendaciones visibles para el rol (cada tipo limitado a `perKind`). */
export const computeInsights = async (role: Role, perKind = 5): Promise<Insight[]> => {
  const kinds = KINDS_BY_ROLE[role];
  const today = todayIso();
  const needsStats = kinds.some((k) => k !== "collect");
  const stats = needsStats ? await productStats() : [];
  const groups: Insight[][] = [];
  if (kinds.includes("restock")) groups.push(restock(stats));
  if (kinds.includes("rotate")) groups.push(await rotate(stats, today));
  if (kinds.includes("collect")) groups.push(await collect(today));
  if (kinds.includes("idle")) groups.push(idle(stats, today));
  return groups.flatMap((g) => g.slice(0, perKind));
};
