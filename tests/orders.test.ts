import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RequestHandler } from "express";
import { isDomainError } from "../src/common/errors";
import {
  parseCreateOrder,
  parseDeliverOrder,
  parseOrderListFilter,
  parseReceiveOrder,
  parseUpdateOrder,
  toOrderResponse,
  toOrderLineResponse,
  type OrderRow,
} from "../src/models/orders";
import { ORDER_KIND_ROLES, assertKindAllowed, canUseKind, kindsForRole, listKindsFor } from "../src/business-logic/orders/order-access";
import { lineTotal, orderTotal } from "../src/business-logic/orders/order-total";
import { planReceipt } from "../src/business-logic/orders/plan-receipt";
import { ordersRouter } from "../src/routes/orders";

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err)) return err.code;
  }
  return undefined;
};

// ------------------------------------------------------------------ parsers

test("parseCreateOrder: proveedor con su proveedor, cliente con su cliente", () => {
  const supplier = parseCreateOrder({ kind: "SUPPLIER", supplierId: 3, dueDate: "2026-11-05", lines: [{ productId: 1, quantity: 4 }] });
  assert.equal(supplier.kind, "SUPPLIER");
  assert.equal(supplier.supplierId, 3);
  assert.equal(supplier.lines[0]?.unitPrice, undefined, "sin precio lo pone el servidor");
  const customer = parseCreateOrder({ kind: "CUSTOMER", customerId: 9, dueDate: "2026-11-05", note: "  ", lines: [{ productId: 1, quantity: 1, unitPrice: 12500.5 }] });
  assert.equal(customer.customerId, 9);
  assert.equal(customer.note, undefined, "una nota vacía no se guarda");
  assert.equal(customer.lines[0]?.unitPrice, 12500.5);
  assert.deepEqual(paths400(() => parseCreateOrder({ kind: "SUPPLIER", customerId: 9, dueDate: "2026-11-05", lines: [{ productId: 1, quantity: 1 }] })), ["supplierId", "customerId"]);
  assert.deepEqual(paths400(() => parseCreateOrder({ kind: "CUSTOMER", supplierId: 3, dueDate: "2026-11-05", lines: [{ productId: 1, quantity: 1 }] })), ["customerId", "supplierId"]);
});

test("parseCreateOrder rechaza tipo, fecha, líneas vacías, repetidas, cantidades y precios inválidos", () => {
  assert.deepEqual(paths400(() => parseCreateOrder({ kind: "OTRO", dueDate: "mañana", lines: [] })), ["kind", "dueDate", "lines"]);
  assert.deepEqual(
    paths400(() => parseCreateOrder({ kind: "SUPPLIER", supplierId: 1, dueDate: "2026-11-05", lines: [{ productId: 2, quantity: 0 }, { productId: 3, quantity: 1, unitPrice: 1.234 }] })),
    ["lines[0].quantity", "lines[1].unitPrice"],
  );
  assert.deepEqual(paths400(() => parseCreateOrder({ kind: "SUPPLIER", supplierId: 1, dueDate: "2026-11-05", lines: [{ productId: 2, quantity: 1 }, { productId: 2, quantity: 3 }] })), ["lines[1].productId"]);
});

test("parseUpdateOrder: al menos un campo, nota null la borra y el tipo no se cambia", () => {
  assert.equal(parseUpdateOrder({ note: null }).note, null);
  assert.equal(parseUpdateOrder({ dueDate: "2026-12-01" }).dueDate, "2026-12-01");
  assert.equal(parseUpdateOrder({ lines: [{ productId: 4, quantity: 2 }] }).lines?.length, 1);
  assert.deepEqual(paths400(() => parseUpdateOrder({})), ["body"]);
  assert.deepEqual(paths400(() => parseUpdateOrder({ kind: "CUSTOMER", note: "x" })), ["kind"]);
  assert.deepEqual(paths400(() => parseUpdateOrder({ lines: [] })), ["lines", "body"]);
});

test("parseReceiveOrder: cantidad, costo real opcional y vencimiento no pasado; sin líneas repetidas", () => {
  const ok = parseReceiveOrder({ lines: [{ lineId: 1, quantity: 5, expiresAt: "2027-01-10" }, { lineId: 2, quantity: 1, unitCost: 3000, expiresAt: "2026-10-29" }] }, "2026-10-29");
  assert.equal(ok.lines.length, 2);
  assert.equal(ok.lines[0]?.unitCost, undefined);
  assert.equal(ok.lines[1]?.unitCost, 3000);
  assert.deepEqual(paths400(() => parseReceiveOrder({ lines: [{ lineId: 1, quantity: 1, expiresAt: "2026-10-28" }] }, "2026-10-29")), ["lines[0].expiresAt"]);
  assert.deepEqual(paths400(() => parseReceiveOrder({ lines: [{ lineId: 1, quantity: 1, expiresAt: "2027-01-01" }, { lineId: 1, quantity: 2, expiresAt: "2027-01-01" }] }, "2026-10-29")), ["lines[1].lineId"]);
  assert.deepEqual(paths400(() => parseReceiveOrder({ lines: [{ lineId: 1, quantity: 0 }] }, "2026-10-29")), ["lines[0].quantity", "lines[0].expiresAt"]);
  assert.deepEqual(paths400(() => parseReceiveOrder({}, "2026-10-29")), ["lines"]);
});

test("parseDeliverOrder: la venta es opcional (cuerpo vacío o null) y debe ser un id positivo", () => {
  assert.deepEqual(parseDeliverOrder(undefined), { saleId: undefined });
  assert.deepEqual(parseDeliverOrder({}), { saleId: undefined });
  assert.deepEqual(parseDeliverOrder({ saleId: null }), { saleId: undefined });
  assert.equal(parseDeliverOrder({ saleId: 12 }).saleId, 12);
  assert.deepEqual(paths400(() => parseDeliverOrder({ saleId: "12" })), ["saleId"]);
  assert.deepEqual(paths400(() => parseDeliverOrder({ saleId: 0 })), ["saleId"]);
});

test("parseOrderListFilter: estados separados por coma, fechas y búsqueda", () => {
  assert.deepEqual(parseOrderListFilter({ kind: "CUSTOMER", status: "PENDING,PARTIAL,PENDING", from: "2026-10-01", to: "2026-10-31", q: "  doña " }), {
    kind: "CUSTOMER",
    statuses: ["PENDING", "PARTIAL"],
    from: "2026-10-01",
    to: "2026-10-31",
    q: "doña",
  });
  assert.deepEqual(parseOrderListFilter({}), { kind: undefined, statuses: undefined, from: undefined, to: undefined, q: undefined });
  assert.deepEqual(paths400(() => parseOrderListFilter({ kind: "X", status: "OPEN", from: "2026-13-01" })), ["kind", "status", "from"]);
  assert.deepEqual(paths400(() => parseOrderListFilter({ from: "2026-11-02", to: "2026-11-01" })), ["to"]);
});

// ------------------------------------------------------------------ reglas puras

test("cada rol ve solo sus tipos: proveedor ADMIN y bodega, cliente ADMIN y secretaria", () => {
  assert.deepEqual(kindsForRole("ADMIN"), ["SUPPLIER", "CUSTOMER"]);
  assert.deepEqual(kindsForRole("WAREHOUSE"), ["SUPPLIER"]);
  assert.deepEqual(kindsForRole("SALES"), ["CUSTOMER"]);
  assert.ok(canUseKind("WAREHOUSE", "SUPPLIER") && !canUseKind("WAREHOUSE", "CUSTOMER"));
  assert.ok(canUseKind("SALES", "CUSTOMER") && !canUseKind("SALES", "SUPPLIER"));
  assert.deepEqual(listKindsFor("SALES"), ["CUSTOMER"]);
  assert.deepEqual(listKindsFor("ADMIN", "SUPPLIER"), ["SUPPLIER"]);
  assert.equal(codeOf(() => listKindsFor("SALES", "SUPPLIER")), "613");
  assert.equal(codeOf(() => listKindsFor("WAREHOUSE", "CUSTOMER")), "613");
  try {
    assertKindAllowed("SALES", "SUPPLIER");
    assert.fail("debía lanzar 613");
  } catch (err) {
    assert.ok(isDomainError(err));
    assert.deepEqual(err.details, { requiredRoles: ["ADMIN", "WAREHOUSE"] });
  }
});

test("total del pedido: suma de cantidad × precio en centavos, sin arrastrar decimales", () => {
  assert.equal(lineTotal(3, 0.1), 0.3);
  assert.equal(orderTotal([]), 0);
  assert.equal(orderTotal([{ quantity: 10, unitPrice: 28000 }, { quantity: 5, unitPrice: 14500.5 }]), 352502.5);
  assert.equal(orderTotal([{ quantity: 3, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }]), 0.5);
  assert.equal(orderTotal([{ quantity: 7, unitPrice: 1999.99 }]), 13999.93);
});

const LINES = [
  { id: 1, productId: 10, quantity: 10, unitPrice: 2000, receivedQuantity: 6 },
  { id: 2, productId: 11, quantity: 5, unitPrice: 900, receivedQuantity: 0 },
];

test("la recepción no supera lo que falta por línea (702) ni toma líneas de otro pedido (400)", () => {
  assert.equal(codeOf(() => planReceipt(LINES, [{ lineId: 1, quantity: 5, expiresAt: "2027-01-01" }])), "702");
  try {
    planReceipt(LINES, [{ lineId: 1, quantity: 5, expiresAt: "2027-01-01" }]);
  } catch (err) {
    assert.ok(isDomainError(err));
    assert.deepEqual(err.details, { lineId: 1, pending: 4, requested: 5 });
  }
  assert.deepEqual(paths400(() => planReceipt(LINES, [{ lineId: 9, quantity: 1, expiresAt: "2027-01-01" }])), ["lines[0].lineId"]);
});

test("recepción parcial y completa: costo real o el esperado, y cuándo queda recibido", () => {
  const partial = planReceipt(LINES, [{ lineId: 2, quantity: 2, unitCost: 950, expiresAt: "2027-01-01" }]);
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.steps, [{ lineId: 2, productId: 11, quantity: 2, unitCost: 950, expiresAt: "2027-01-01" }]);
  const full = planReceipt(LINES, [
    { lineId: 1, quantity: 4, expiresAt: "2027-02-01" },
    { lineId: 2, quantity: 5, expiresAt: "2027-03-01" },
  ]);
  assert.equal(full.complete, true);
  assert.equal(full.steps[0]?.unitCost, 2000, "sin costo real se usa el esperado");
});

test("respuesta del pedido: contraparte, abierto, vencido y días a la fecha; pendiente por línea", () => {
  const row: OrderRow = {
    id: 4,
    kind: "CUSTOMER",
    supplierId: null,
    supplierName: null,
    customerId: 7,
    customerName: "Avícola Doña Elvia",
    status: "PENDING",
    dueDate: "2026-10-27",
    note: null,
    total: 98000,
    lineCount: 1,
    createdBy: 1,
    createdByUsername: "demo.caja",
    createdAt: new Date("2026-10-20T15:00:00Z"),
    updatedAt: new Date("2026-10-20T15:00:00Z"),
    closedAt: null,
    closedBy: null,
    closedByUsername: null,
    saleId: null,
    saleInvoiceNumber: null,
  };
  const overdue = toOrderResponse(row, "2026-10-29");
  assert.equal(overdue.counterpartName, "Avícola Doña Elvia");
  assert.deepEqual([overdue.open, overdue.overdue, overdue.daysToDue], [true, true, -2]);
  const cancelled = toOrderResponse({ ...row, status: "CANCELLED", closedAt: new Date("2026-10-28T12:00:00Z") }, "2026-10-29");
  assert.deepEqual([cancelled.open, cancelled.overdue], [false, false], "un pedido cerrado nunca está vencido");
  assert.equal(toOrderLineResponse({ id: 1, productId: 2, productName: "x", sku: "X", quantity: 10, unitPrice: 1, receivedQuantity: 4, lineTotal: 10 }).pendingQuantity, 6);
});

// ------------------------------------------------------------------ una prueba por endpoint

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler; name: string }[] } };

const routeOf = (method: string, path: string) => {
  const layer = (ordersRouter.stack as unknown as Layer[]).find((l) => l.route?.path === path && l.route.methods[method] === true);
  assert.ok(layer?.route, `${method.toUpperCase()} ${path} registrado`);
  return layer.route;
};

/** El primer manejador es `authorize`: sin identidad responde 611 (la ruta nace protegida aunque se monte suelta). */
const assertProtected = (method: string, path: string, controller: string) => {
  const route = routeOf(method, path);
  assert.equal(route.stack.length, 2, "authorize + controlador");
  assert.equal(route.stack[1]?.name, controller);
  const auth = route.stack[0]!.handle;
  assert.equal(
    codeOf(() => auth({} as never, {} as never, () => undefined)),
    "611",
  );
};

test("GET /orders: protegida; el listado filtra por los tipos del rol", () => {
  assertProtected("get", "/", "listOrdersController");
  assert.deepEqual(listKindsFor("WAREHOUSE"), ["SUPPLIER"]);
});

test("POST /orders: protegida; crea con el parser y el tipo debe ser del rol", () => {
  assertProtected("post", "/", "createOrderController");
  assert.equal(codeOf(() => assertKindAllowed("WAREHOUSE", parseCreateOrder({ kind: "CUSTOMER", customerId: 1, dueDate: "2026-11-01", lines: [{ productId: 1, quantity: 1 }] }).kind)), "613");
});

test("GET /orders/:id: protegida", () => {
  assertProtected("get", "/:id", "getOrderController");
});

test("PUT /orders/:id: protegida; el cuerpo vacío no llega a la lógica", () => {
  assertProtected("put", "/:id", "updateOrderController");
  assert.deepEqual(paths400(() => parseUpdateOrder(undefined)), ["body", "body"]);
});

test("POST /orders/:id/receive: protegida y solo para quienes manejan pedidos a proveedor", () => {
  assertProtected("post", "/:id/receive", "receiveOrderController");
  assert.deepEqual(ORDER_KIND_ROLES.SUPPLIER, ["ADMIN", "WAREHOUSE"]);
});

test("POST /orders/:id/deliver: protegida y solo para quienes manejan encargos de cliente", () => {
  assertProtected("post", "/:id/deliver", "deliverOrderController");
  assert.deepEqual(ORDER_KIND_ROLES.CUSTOMER, ["ADMIN", "SALES"]);
});

test("POST /orders/:id/cancel: protegida", () => {
  assertProtected("post", "/:id/cancel", "cancelOrderController");
});
