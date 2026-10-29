/**
 * Avisos de vencimiento por rol (brief de octubre de 2026, punto 13). Los calcula el servidor: lotes por vencer o
 * vencidos (ADMIN y WAREHOUSE) y cartera vencida o próxima a vencer (ADMIN y SALES). «Pedidos por vencer» queda
 * pendiente: no existe tabla de pedidos ni plazo de cartera por cliente.
 */
export const DUE_KINDS = ["batch_expiring", "batch_expired", "receivable_overdue", "receivable_due_soon"] as const;
export type DueKind = (typeof DUE_KINDS)[number];

export type DueItem = {
  kind: DueKind;
  /** Id del lote o del cliente. */
  id: number;
  title: string;
  detail: string;
  /** Fecha de vencimiento (YYYY-MM-DD) del lote o de la cartera. */
  dueOn: string;
  /** Pantalla de la app a la que lleva. */
  href: string;
};

export type DueNoticesResponse = { count: number; summary: string; items: DueItem[] };
