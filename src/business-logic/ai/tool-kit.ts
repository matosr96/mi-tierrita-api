import type Anthropic from "@anthropic-ai/sdk";
import { isDomainError } from "../../common/index";
import { Roles, type Role } from "../../security/index";

/**
 * Base de las herramientas de Tita. Las de consulta llaman a la lógica de negocio con los roles de su endpoint; las de
 * acción NO escriben: validan con el mismo `parseX` del endpoint y devuelven una `Proposal` de tipo "action" con la
 * petición exacta (método, ruta y cuerpo). La app la muestra como tarjeta y, si la persona confirma, la envía a la API
 * real: mismos permisos, validaciones y auditoría que si la hiciera desde la pantalla.
 */

/** Pantalla con el formulario prellenado, para quien prefiera revisarlo allí (venta, abono o compra). */
export type Handoff =
  | { type: "sale"; customerId: number | null; customerName: string | null; paymentType: "CASH" | "CREDIT"; lines: { productId: number; productName: string; quantity: number; unitPrice: number; available: number }[]; estimatedTotal: number; warnings: string[] }
  | { type: "payment"; customerId: number; customerName: string; amount: number; balance: number }
  | { type: "purchase"; supplierId: number | null; supplierName: string | null; productId: number; productName: string; quantity: number; unitCost: number; expiresAt: string };

export type ActionRequest = { method: "POST" | "PUT" | "PATCH" | "DELETE"; path: string; body?: Record<string, unknown> };

export type ReportKind = "sales" | "inventory" | "receivables";

export type Proposal =
  | { type: "action"; kind: string; title: string; lines: string[]; warnings: string[]; confirmLabel: string; request: ActionRequest; handoff?: Handoff }
  | { type: "report"; report: ReportKind; title: string; lines: string[]; params: Record<string, string | number> };

export type Source = { tool: string; label: string };

export type ToolContext = { role: Role; userId: number; proposals: Proposal[]; sources: Source[] };

export type ToolDef = {
  roles: readonly Role[];
  label: string;
  spec: Anthropic.Tool;
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

export const ALL: readonly Role[] = [Roles.ADMIN, Roles.SALES, Roles.WAREHOUSE];
export const page = (limit = 20) => ({ page: 1, limit, offset: 0 });
export const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
export const int = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined);
export const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
export const isoDate = (v: unknown): string | undefined => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
export const obj = (properties: Record<string, unknown>, required: string[] = []): Anthropic.Tool.InputSchema => ({ type: "object", properties, required });

/** Quita los campos sin valor para que el cuerpo sea exactamente lo que la persona pidió. */
export const clean = (body: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));

/**
 * Valida el cuerpo con el `parseX` del endpoint. Si falla, devuelve los campos inválidos para que Tita los pida en vez
 * de dejar una tarjeta que la API rechazaría.
 */
export const validate = (parse: (body: unknown) => unknown, body: Record<string, unknown>): { ok: true } | { ok: false; error: unknown } => {
  try {
    parse(body);
    return { ok: true };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, error: { error: "Datos incompletos o inválidos", campos: err.details } };
    throw err;
  }
};

/** Registra la propuesta y responde al modelo que quedó lista para que la persona confirme. */
export const propose = (ctx: ToolContext, p: Proposal) => {
  ctx.proposals.push(p);
  return p.type === "report"
    ? { estado: "Reporte listo: la persona lo abre desde la tarjeta del chat para verlo, imprimirlo en PDF o descargarlo en Excel.", resumen: p.lines }
    : { estado: "Tarjeta lista: la persona debe pulsar Confirmar en el chat. Aún no se ha registrado nada.", resumen: p.lines };
};
