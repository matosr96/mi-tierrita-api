/** Redondeo a centavos, como DECIMAL(12,2). */
const toCents = (value: number): number => Math.round(value * 100);

/** Subtotal de una línea: cantidad × precio (o costo), redondeado a centavos. */
export const lineTotal = (quantity: number, unitPrice: number): number => toCents(quantity * unitPrice) / 100;

/** Total del pedido (función pura): suma de los subtotales de sus líneas, sumando en centavos para no arrastrar decimales. */
export const orderTotal = (lines: readonly { quantity: number; unitPrice: number }[]): number =>
  lines.reduce((cents, l) => cents + toCents(lineTotal(l.quantity, l.unitPrice)), 0) / 100;
