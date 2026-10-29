import { addDaysIso } from "../../common/index";
import type { DueItem } from "../../models/index";
import type { Role } from "../../security/index";

/**
 * Clasificación pura de los vencimientos (sin base de datos): a partir de los lotes de la ventana y de la cartera
 * con saldo, arma la lista de avisos que le corresponde a un rol. ADMIN y WAREHOUSE ven lotes; ADMIN y SALES ven
 * cartera. Reglas: lote vencido (`daysToExpire` < 0) o por vencer dentro de `batchDays` días; cartera vencida con la
 * misma regla del reporte (última venta a crédito con más de `overdueDays` días) o a `dueSoonDays` de cumplirlos
 * (`today` es la fecha local del negocio, YYYY-MM-DD).
 */
export const DUE_BATCH_DAYS = 7;
export const DUE_SOON_DAYS = 5;

export type DueBatch = { id: number; productName: string; quantityRemaining: number; expiresAt: string; daysToExpire: number };
export type DueReceivable = { customerId: number; name: string; balance: number; lastCreditSaleAt: string | null; overdue: boolean };

const money = (n: number): string => `$ ${Math.round(n).toLocaleString("es-CO")}`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const seesBatches = (role: Role): boolean => role === "ADMIN" || role === "WAREHOUSE";
export const seesReceivables = (role: Role): boolean => role === "ADMIN" || role === "SALES";

export const classifyDue = (
  role: Role,
  batches: DueBatch[],
  receivables: DueReceivable[],
  options: { overdueDays: number; today: string; batchDays?: number; dueSoonDays?: number },
): DueItem[] => {
  const batchDays = options.batchDays ?? DUE_BATCH_DAYS;
  const dueSoonDays = options.dueSoonDays ?? DUE_SOON_DAYS;
  const items: DueItem[] = [];
  if (seesBatches(role)) {
    for (const b of batches) {
      if (b.quantityRemaining <= 0) continue;
      if (b.daysToExpire < 0) {
        items.push({ kind: "batch_expired", id: b.id, title: `Lote #${b.id} de ${b.productName} vencido`, detail: `Venció hace ${plural(-b.daysToExpire, "día", "días")} · ${plural(b.quantityRemaining, "unidad", "unidades")} en bodega`, dueOn: b.expiresAt, href: "/lotes" });
      } else if (b.daysToExpire <= batchDays) {
        items.push({ kind: "batch_expiring", id: b.id, title: `Lote #${b.id} de ${b.productName} por vencer`, detail: b.daysToExpire === 0 ? `Vence hoy · ${plural(b.quantityRemaining, "unidad", "unidades")}` : `Vence en ${plural(b.daysToExpire, "día", "días")} · ${plural(b.quantityRemaining, "unidad", "unidades")}`, dueOn: b.expiresAt, href: "/lotes" });
      }
    }
  }
  if (seesReceivables(role)) {
    for (const r of receivables) {
      if (r.balance <= 0 || r.lastCreditSaleAt === null) continue;
      const dueOn = addDaysIso(r.lastCreditSaleAt.slice(0, 10), options.overdueDays);
      if (r.overdue) {
        items.push({ kind: "receivable_overdue", id: r.customerId, title: `Cartera vencida de ${r.name}`, detail: `Debe ${money(r.balance)} · plazo de ${options.overdueDays} días cumplido el ${dueOn}`, dueOn, href: "/clientes" });
        continue;
      }
      const soonFrom = addDaysIso(r.lastCreditSaleAt.slice(0, 10), options.overdueDays - dueSoonDays);
      if (options.today >= soonFrom) {
        items.push({ kind: "receivable_due_soon", id: r.customerId, title: `Cobro por vencer: ${r.name}`, detail: `Debe ${money(r.balance)} · el plazo de ${options.overdueDays} días se cumple el ${dueOn}`, dueOn, href: "/clientes" });
      }
    }
  }
  const order: Record<DueItem["kind"], number> = { batch_expired: 0, receivable_overdue: 1, batch_expiring: 2, receivable_due_soon: 3 };
  return items.sort((a, b) => order[a.kind] - order[b.kind] || a.dueOn.localeCompare(b.dueOn));
};

/** Resumen en una línea para el aviso diario y el toast de la app. */
export const summarizeDue = (items: DueItem[]): string => {
  const count = (kind: DueItem["kind"]) => items.filter((i) => i.kind === kind).length;
  const parts: string[] = [];
  const expired = count("batch_expired");
  const expiring = count("batch_expiring");
  const overdue = count("receivable_overdue");
  const soon = count("receivable_due_soon");
  if (expired > 0) parts.push(plural(expired, "lote vencido", "lotes vencidos"));
  if (expiring > 0) parts.push(plural(expiring, "lote por vencer", "lotes por vencer"));
  if (overdue > 0) parts.push(plural(overdue, "cliente con cartera vencida", "clientes con cartera vencida"));
  if (soon > 0) parts.push(plural(soon, "cobro por vencer", "cobros por vencer"));
  return parts.length === 0 ? "Sin vencimientos pendientes" : parts.join(" · ");
};
