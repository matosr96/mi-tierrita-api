import { ErrorCodes, domainError, type ValidationIssue } from "../../common/index";
import type { ReceiveOrderLineRequest } from "../../models/index";

type PlannedLine = { id: number; productId: number; quantity: number; unitPrice: number; receivedQuantity: number };

export type ReceiptStep = { lineId: number; productId: number; quantity: number; unitCost: number; expiresAt: string };
export type ReceiptPlan = { steps: ReceiptStep[]; complete: boolean };

/**
 * Valida una recepción contra las líneas del pedido (función pura) y dice qué registrar:
 * - una línea que no es del pedido → 400 en `lines[i].lineId`;
 * - recibir más de lo que falta en una línea → 702 con `{ lineId, pending, requested }`;
 * - sin costo real se usa el costo esperado de la línea.
 * `complete` es true si, con esta recepción, todas las líneas quedan recibidas por completo.
 */
export const planReceipt = (lines: readonly PlannedLine[], receipt: readonly ReceiveOrderLineRequest[]): ReceiptPlan => {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const issues: ValidationIssue[] = [];
  receipt.forEach((r, index) => {
    if (!byId.has(r.lineId)) issues.push({ path: `lines[${index}].lineId`, message: "La línea no es de este pedido" });
  });
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);

  const received = new Map(lines.map((l) => [l.id, l.receivedQuantity]));
  const steps = receipt.map((r): ReceiptStep => {
    const line = byId.get(r.lineId)!;
    const pending = line.quantity - line.receivedQuantity;
    if (r.quantity > pending) throw domainError(ErrorCodes.ORDER_RECEIPT_EXCEEDS, { lineId: r.lineId, pending, requested: r.quantity });
    received.set(line.id, line.receivedQuantity + r.quantity);
    return { lineId: line.id, productId: line.productId, quantity: r.quantity, unitCost: r.unitCost ?? line.unitPrice, expiresAt: r.expiresAt };
  });
  const complete = lines.every((l) => (received.get(l.id) ?? 0) >= l.quantity);
  return { steps, complete };
};
