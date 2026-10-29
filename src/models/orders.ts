import { todayIso } from "../common/dates";
import { createValidator, isIsoDate } from "../common/validate";
import { MONEY_RULE } from "./products";

/** Pedido a proveedor (lo que se espera recibir) o de cliente (un encargo). Una sola tabla, `orders.kind`. */
export const OrderKinds = { SUPPLIER: "SUPPLIER", CUSTOMER: "CUSTOMER" } as const;
export type OrderKind = (typeof OrderKinds)[keyof typeof OrderKinds];
export const ALL_ORDER_KINDS = [OrderKinds.SUPPLIER, OrderKinds.CUSTOMER] as const;

/** PARTIAL y RECEIVED son solo de proveedor; DELIVERED solo de cliente. */
export const OrderStatuses = {
  PENDING: "PENDING",
  PARTIAL: "PARTIAL",
  RECEIVED: "RECEIVED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatuses)[keyof typeof OrderStatuses];
export const ALL_ORDER_STATUSES = [OrderStatuses.PENDING, OrderStatuses.PARTIAL, OrderStatuses.RECEIVED, OrderStatuses.DELIVERED, OrderStatuses.CANCELLED] as const;
/** Abiertos: aún se esperan (aparecen en el calendario y en los avisos). */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [OrderStatuses.PENDING, OrderStatuses.PARTIAL];

export type OrderRow = {
  id: number;
  kind: OrderKind;
  supplierId: number | null;
  supplierName: string | null;
  customerId: number | null;
  customerName: string | null;
  status: OrderStatus;
  dueDate: string;
  note: string | null;
  total: number;
  lineCount: number;
  createdBy: number;
  createdByUsername: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  closedBy: number | null;
  closedByUsername: string | null;
  saleId: number | null;
  saleInvoiceNumber: string | null;
};

export type OrderLineRow = {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
  lineTotal: number;
};

/** `pendingQuantity` = lo que falta recibir (proveedor) o entregar (cliente). */
export type OrderLineResponse = OrderLineRow & { pendingQuantity: number };

/**
 * `overdue`: abierto con fecha anterior a hoy (hora del negocio). `daysToDue`: días de hoy a la fecha (negativo si ya
 * pasó). `counterpartName`: el proveedor o el cliente, según el tipo.
 */
export type OrderResponse = Omit<OrderRow, "createdAt" | "updatedAt" | "closedAt"> & {
  counterpartName: string;
  open: boolean;
  overdue: boolean;
  daysToDue: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};
export type OrderDetailResponse = OrderResponse & { lines: OrderLineResponse[] };

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

export const toOrderResponse = (row: OrderRow, today: string = todayIso()): OrderResponse => {
  const open = OPEN_ORDER_STATUSES.includes(row.status);
  const daysToDue = daysBetween(today, row.dueDate);
  return {
    ...row,
    counterpartName: (row.kind === OrderKinds.SUPPLIER ? row.supplierName : row.customerName) ?? "—",
    open,
    overdue: open && daysToDue < 0,
    daysToDue,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt === null ? null : row.closedAt.toISOString(),
  };
};

export const toOrderLineResponse = (row: OrderLineRow): OrderLineResponse => ({ ...row, pendingQuantity: row.quantity - row.receivedQuantity });

const QUANTITY_RULE = { integer: true, min: 1, max: 1_000_000 };
const NOTE_RULE = { max: 500 };
const MAX_LINES = 100;

/** Línea pedida: el precio (cliente) o costo esperado (proveedor) es opcional; sin él lo pone el servidor. */
export type OrderLineRequest = { productId: number; quantity: number; unitPrice?: number | undefined };

const parseLines = (v: ReturnType<typeof createValidator>, required: boolean): OrderLineRequest[] | undefined => {
  const lines = v.array<OrderLineRequest>(
    "lines",
    { min: 1, max: MAX_LINES },
    (item) => {
      const productId = item.number("productId", { integer: true, min: 1 });
      const quantity = item.number("quantity", QUANTITY_RULE);
      const unitPrice = item.number("unitPrice", MONEY_RULE, false);
      return productId === undefined || quantity === undefined ? undefined : { productId, quantity, unitPrice };
    },
    required,
  );
  if (lines !== undefined) {
    const seen = new Set<number>();
    lines.forEach((line, index) => {
      if (seen.has(line.productId)) v.custom(`lines[${index}].productId`, "Producto repetido: sume la cantidad en una sola línea");
      seen.add(line.productId);
    });
  }
  return lines;
};

export type CreateOrderRequest = {
  kind: OrderKind;
  supplierId?: number | undefined;
  customerId?: number | undefined;
  dueDate: string;
  note?: string | undefined;
  lines: OrderLineRequest[];
};

export const parseCreateOrder = (body: unknown): CreateOrderRequest => {
  const v = createValidator(body);
  const kind = v.oneOf("kind", ALL_ORDER_KINDS);
  const supplierId = v.number("supplierId", { integer: true, min: 1 }, false);
  const customerId = v.number("customerId", { integer: true, min: 1 }, false);
  const dueDate = v.date("dueDate");
  const note = v.string("note", NOTE_RULE, false);
  const lines = parseLines(v, true);
  if (kind === OrderKinds.SUPPLIER) {
    if (supplierId === undefined) v.custom("supplierId", "Obligatorio en un pedido a proveedor");
    if (customerId !== undefined) v.custom("customerId", "Un pedido a proveedor no lleva cliente");
  }
  if (kind === OrderKinds.CUSTOMER) {
    if (customerId === undefined) v.custom("customerId", "Obligatorio en un pedido de cliente");
    if (supplierId !== undefined) v.custom("supplierId", "Un pedido de cliente no lleva proveedor");
  }
  v.done();
  return { kind: kind!, supplierId, customerId, dueDate: dueDate!, note: note === "" ? undefined : note, lines: lines! };
};

/** Todo opcional; `note: null` la borra. `lines` reemplaza todas las líneas. El tipo del pedido no cambia. */
export type UpdateOrderRequest = {
  supplierId?: number | undefined;
  customerId?: number | undefined;
  dueDate?: string | undefined;
  note?: string | null | undefined;
  lines?: OrderLineRequest[] | undefined;
};

export const parseUpdateOrder = (body: unknown): UpdateOrderRequest => {
  const v = createValidator(body);
  const note = v.isNull("note") ? null : v.string("note", NOTE_RULE, false);
  const result: UpdateOrderRequest = {
    supplierId: v.number("supplierId", { integer: true, min: 1 }, false),
    customerId: v.number("customerId", { integer: true, min: 1 }, false),
    dueDate: v.date("dueDate", false),
    note: note === "" ? null : note,
    lines: parseLines(v, false),
  };
  if (v.has("kind")) v.custom("kind", "El tipo de un pedido no se cambia: cancele este y cree otro");
  if (Object.values(result).every((field) => field === undefined)) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return result;
};

/** Recepción de un pedido a proveedor: por línea, cantidad que llegó, costo real (opcional) y vencimiento del lote. */
export type ReceiveOrderLineRequest = { lineId: number; quantity: number; unitCost?: number | undefined; expiresAt: string };
export type ReceiveOrderRequest = { lines: ReceiveOrderLineRequest[] };

export const parseReceiveOrder = (body: unknown, today: string = todayIso()): ReceiveOrderRequest => {
  const v = createValidator(body);
  const lines = v.array<ReceiveOrderLineRequest>("lines", { min: 1, max: MAX_LINES }, (item) => {
    const lineId = item.number("lineId", { integer: true, min: 1 });
    const quantity = item.number("quantity", QUANTITY_RULE);
    const unitCost = item.number("unitCost", MONEY_RULE, false);
    const expiresAt = item.date("expiresAt");
    if (expiresAt !== undefined && expiresAt < today) item.custom("expiresAt", "El lote ya está vencido; no puede ingresar a bodega");
    return lineId === undefined || quantity === undefined || expiresAt === undefined ? undefined : { lineId, quantity, unitCost, expiresAt };
  });
  if (lines !== undefined) {
    const seen = new Set<number>();
    lines.forEach((line, index) => {
      if (seen.has(line.lineId)) v.custom(`lines[${index}].lineId`, "Línea repetida");
      seen.add(line.lineId);
    });
  }
  v.done();
  return { lines: lines! };
};

/** Entrega de un pedido de cliente: opcionalmente, la venta con que se cobró. */
export type DeliverOrderRequest = { saleId?: number | undefined };

export const parseDeliverOrder = (body: unknown): DeliverOrderRequest => {
  const v = createValidator(body ?? {});
  const saleId = v.isNull("saleId") ? undefined : v.number("saleId", { integer: true, min: 1 }, false);
  v.done();
  return { saleId };
};

export type OrderListFilter = {
  kind?: OrderKind | undefined;
  statuses?: OrderStatus[] | undefined;
  from?: string | undefined;
  to?: string | undefined;
  q?: string | undefined;
};

/**
 * Filtros de `GET /orders`: `kind`, `status` (uno o varios separados por coma: `PENDING,PARTIAL`), `from`/`to` sobre la
 * fecha comprometida y `q` (proveedor, cliente, nota o número). Un `kind` o `status` desconocido responde 400.
 */
export const parseOrderListFilter = (query: Record<string, unknown>): OrderListFilter => {
  const v = createValidator({});
  const rawKind = query["kind"];
  let kind: OrderKind | undefined;
  if (typeof rawKind === "string" && rawKind !== "") {
    if ((ALL_ORDER_KINDS as readonly string[]).includes(rawKind)) kind = rawKind as OrderKind;
    else v.custom("kind", `Debe ser uno de: ${ALL_ORDER_KINDS.join(", ")}`);
  }
  const rawStatus = query["status"];
  let statuses: OrderStatus[] | undefined;
  if (typeof rawStatus === "string" && rawStatus !== "") {
    const parts = rawStatus.split(",").map((s) => s.trim()).filter((s) => s !== "");
    if (parts.every((s) => (ALL_ORDER_STATUSES as readonly string[]).includes(s))) statuses = [...new Set(parts)] as OrderStatus[];
    else v.custom("status", `Debe ser uno o varios de: ${ALL_ORDER_STATUSES.join(", ")}`);
  }
  const date = (field: string): string | undefined => {
    const raw = query[field];
    if (raw === undefined || raw === "") return undefined;
    if (isIsoDate(raw)) return raw;
    v.custom(field, "Formato esperado YYYY-MM-DD");
    return undefined;
  };
  const from = date("from");
  const to = date("to");
  if (from !== undefined && to !== undefined && from > to) v.custom("to", "Debe ser igual o posterior a from");
  const rawQ = query["q"];
  const q = typeof rawQ === "string" && rawQ.trim() !== "" ? rawQ.trim().slice(0, 100) : undefined;
  // createValidator({}) no acumula nada propio: solo los problemas registrados arriba.
  v.done();
  return { kind, statuses, from, to, q };
};
