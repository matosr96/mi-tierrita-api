/**
 * Avisos de vencimiento por rol (brief de octubre de 2026, punto 13). Los calcula el servidor: lotes por vencer o
 * vencidos (ADMIN y WAREHOUSE), cartera vencida o próxima a vencer (ADMIN y SALES), pedidos atrasados o por vencer
 * (a proveedor: ADMIN y WAREHOUSE; de cliente: ADMIN y SALES), nómina por pagar (ADMIN) y conteos de inventario
 * atrasados o de hoy y mañana (ADMIN y WAREHOUSE).
 */
export const DUE_KINDS = [
  "batch_expiring",
  "batch_expired",
  "receivable_overdue",
  "receivable_due_soon",
  "order_overdue",
  "order_due_soon",
  "payroll_due",
  "count_overdue",
  "count_due",
] as const;
export type DueKind = (typeof DUE_KINDS)[number];

export type DueItem = {
  kind: DueKind;
  /** Id del lote, cliente, pedido, periodo de nómina o conteo. */
  id: number;
  title: string;
  detail: string;
  /** Fecha de vencimiento (YYYY-MM-DD): lote, cartera, entrega del pedido, pago de nómina o fecha del conteo. */
  dueOn: string;
  /** Pantalla de la app a la que lleva. */
  href: string;
};

export type DueNoticesResponse = { count: number; summary: string; items: DueItem[] };
