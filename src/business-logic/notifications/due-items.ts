import { addDaysIso } from "../../common/index";
import type { DueItem, ScheduledCount, UpcomingPayroll } from "../../models/index";
import type { Role } from "../../security/index";
import type { DueOrder } from "../orders/list-due-orders";
import { kindsForRole } from "../orders/order-access";

/**
 * Clasificación pura de los vencimientos (sin base de datos): a partir de los lotes de la ventana y de la cartera
 * con saldo, arma la lista de avisos que le corresponde a un rol. ADMIN y WAREHOUSE ven lotes; ADMIN y SALES ven
 * cartera. Reglas: lote vencido (`daysToExpire` < 0) o por vencer dentro de `batchDays` días; cartera vencida con la
 * misma regla del reporte (última venta a crédito con más de `overdueDays` días) o a `dueSoonDays` de cumplirlos
 * (`today` es la fecha local del negocio, YYYY-MM-DD).
 */
export const DUE_BATCH_DAYS = 7;
export const DUE_SOON_DAYS = 5;
/** Pedidos: se avisa si ya pasó la fecha o faltan 2 días o menos. */
export const ORDER_SOON_DAYS = 2;
/** Nómina: se avisa desde 3 días antes de la fecha de pago (y mientras siga sin pagarse). */
export const PAYROLL_SOON_DAYS = 3;
/** Conteos: se avisan el día anterior, el mismo día y mientras sigan atrasados. */
export const COUNT_SOON_DAYS = 1;

export type DueBatch = { id: number; productName: string; quantityRemaining: number; expiresAt: string; daysToExpire: number };
export type DueReceivable = { customerId: number; name: string; balance: number; lastCreditSaleAt: string | null; overdue: boolean };

const money = (n: number): string => `$ ${Math.round(n).toLocaleString("es-CO")}`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const seesBatches = (role: Role): boolean => role === "ADMIN" || role === "WAREHOUSE";
export const seesReceivables = (role: Role): boolean => role === "ADMIN" || role === "SALES";
export const seesPayroll = (role: Role): boolean => role === "ADMIN";
export const seesCounts = (role: Role): boolean => role === "ADMIN" || role === "WAREHOUSE";

/** Pedidos, nómina y conteos que entran en los avisos (opcionales: cada lista llega ya consultada). */
export type DueExtras = { orders?: DueOrder[]; payroll?: UpcomingPayroll[]; counts?: ScheduledCount[] };

const daysBetween = (fromIso: string, toIso: string): number => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
const inDays = (d: number): string => (d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} días`);
const FREQ: Record<UpcomingPayroll["frequency"], string> = { MONTHLY: "mensual", BIWEEKLY: "quincenal" };

export const classifyDue = (
  role: Role,
  batches: DueBatch[],
  receivables: DueReceivable[],
  options: { overdueDays: number; today: string; batchDays?: number; dueSoonDays?: number },
  extras: DueExtras = {},
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
  const kinds = kindsForRole(role);
  for (const o of extras.orders ?? []) {
    if (!kinds.includes(o.kind)) continue;
    const what = o.kind === "SUPPLIER" ? `Pedido #${o.id} a ${o.counterpartName}` : `Pedido #${o.id} de ${o.counterpartName}`;
    const verb = o.kind === "SUPPLIER" ? "llegar" : "entregarse";
    const units = plural(o.pendingUnits, "unidad pendiente", "unidades pendientes");
    if (o.overdue) items.push({ kind: "order_overdue", id: o.id, title: `${what} atrasado`, detail: `Debía ${verb} hace ${plural(-o.daysToDue, "día", "días")} · ${units}`, dueOn: o.dueDate, href: o.href });
    else if (o.daysToDue <= ORDER_SOON_DAYS) items.push({ kind: "order_due_soon", id: o.id, title: `${what} por ${o.kind === "SUPPLIER" ? "llegar" : "entregar"}`, detail: `Debe ${verb} ${inDays(o.daysToDue)} · ${units}`, dueOn: o.dueDate, href: o.href });
  }
  if (seesPayroll(role)) {
    for (const p of extras.payroll ?? []) {
      const d = daysBetween(options.today, p.payDate);
      if (d > PAYROLL_SOON_DAYS) continue;
      const state = p.status === "DRAFT" ? "en borrador" : "aprobada";
      items.push({
        kind: "payroll_due",
        id: p.id,
        title: d < 0 ? `Nómina ${FREQ[p.frequency]} sin pagar` : `Pago de nómina ${FREQ[p.frequency]} ${inDays(d)}`,
        detail: `${d < 0 ? `Debía pagarse hace ${plural(-d, "día", "días")}` : `Periodo ${p.periodStart} a ${p.periodEnd}`} · neto ${money(p.totalNet)} · ${state}`,
        dueOn: p.payDate,
        href: `/nomina?periodo=${p.id}`,
      });
    }
  }
  if (seesCounts(role)) {
    for (const c of extras.counts ?? []) {
      const d = daysBetween(options.today, c.scheduledDate);
      const scope = c.scope === "ALL" ? "todo el inventario" : (c.categoryName ?? "una categoría");
      if (c.overdue) items.push({ kind: "count_overdue", id: c.id, title: `Conteo atrasado: ${c.title}`, detail: `Programado hace ${plural(-d, "día", "días")} · ${scope}`, dueOn: c.scheduledDate, href: `/conteos?c=${c.id}` });
      else if (d <= COUNT_SOON_DAYS) items.push({ kind: "count_due", id: c.id, title: `Conteo ${inDays(d)}: ${c.title}`, detail: `${c.status === "IN_PROGRESS" ? "En curso" : "Programado"} · ${scope}`, dueOn: c.scheduledDate, href: `/conteos?c=${c.id}` });
    }
  }
  const order: Record<DueItem["kind"], number> = {
    batch_expired: 0,
    receivable_overdue: 1,
    order_overdue: 2,
    count_overdue: 3,
    payroll_due: 4,
    batch_expiring: 5,
    receivable_due_soon: 6,
    order_due_soon: 7,
    count_due: 8,
  };
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
  const orders = count("order_overdue") + count("order_due_soon");
  const payroll = count("payroll_due");
  const counts = count("count_overdue") + count("count_due");
  if (orders > 0) parts.push(plural(orders, "pedido por atender", "pedidos por atender"));
  if (payroll > 0) parts.push(plural(payroll, "nómina por pagar", "nóminas por pagar"));
  if (counts > 0) parts.push(plural(counts, "conteo de inventario", "conteos de inventario"));
  return parts.length === 0 ? "Sin vencimientos pendientes" : parts.join(" · ");
};
