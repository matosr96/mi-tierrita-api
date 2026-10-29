import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, RequestHandler, Response } from "express";
import { isDomainError } from "../src/common/errors";
import {
  parseApplyStockCount,
  parseCreateStockCount,
  parseSaveStockCountLines,
  parseStockCountListFilter,
  parseUpdateStockCount,
  stockCountDue,
} from "../src/models/stock-counts";
import { assertTransition, canTransition, countDifference, type StockCountAction } from "../src/business-logic/stock-counts/stock-count-rules";
import { planFefoShortage } from "../src/business-logic/stock-counts/plan-fefo-shortage";
import { summarizeLines } from "../src/business-logic/stock-counts/stock-count-queries";
import { stockCountsRouter } from "../src/routes/stock-counts";
import * as controllers from "../src/controllers/stock-counts/index";

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
    throw err;
  }
  return undefined;
};

const TODAY = "2026-10-29";

// ---------------------------------------------------------------- parsers

test("parseCreateStockCount: título, fecha y alcance; la categoría solo con alcance CATEGORY", () => {
  const all = parseCreateStockCount({ title: " Conteo general ", scheduledDate: "2026-11-02", categoryId: 4 });
  assert.equal(all.title, "Conteo general");
  assert.equal(all.scope, "ALL");
  assert.equal(all.categoryId, null, "con alcance ALL la categoría se ignora");
  assert.equal(all.note, null);
  const cat = parseCreateStockCount({ title: "Aves", scheduledDate: "2026-11-02", scope: "CATEGORY", categoryId: 14, note: "Antes del pedido" });
  assert.equal(cat.categoryId, 14);
  assert.equal(cat.note, "Antes del pedido");
  assert.deepEqual(paths400(() => parseCreateStockCount({ title: "x", scheduledDate: "2026-11-02", scope: "CATEGORY" })), ["categoryId"]);
  assert.deepEqual(paths400(() => parseCreateStockCount({ title: "", scheduledDate: "02/11/2026", scope: "BODEGA" })), ["title", "scheduledDate", "scope"]);
  assert.deepEqual(paths400(() => parseCreateStockCount({ title: "x".repeat(121), scheduledDate: "2026-11-02" })), ["title"]);
});

test("parseUpdateStockCount: al menos un campo; la nota null o vacía se borra", () => {
  assert.deepEqual(parseUpdateStockCount({ title: "Nuevo" }), { title: "Nuevo", scheduledDate: undefined, note: undefined });
  assert.equal(parseUpdateStockCount({ note: null }).note, null);
  assert.equal(parseUpdateStockCount({ note: "" }).note, null);
  assert.deepEqual(paths400(() => parseUpdateStockCount({})), ["body"]);
  assert.deepEqual(paths400(() => parseUpdateStockCount({ scheduledDate: "2026-13-01" })), ["scheduledDate"]);
});

test("parseSaveStockCountLines: enteros >= 0, null deja sin contar, sin productos repetidos", () => {
  const ok = parseSaveStockCountLines({ lines: [{ productId: 3, countedQuantity: 0 }, { productId: 4, countedQuantity: null, note: "" }, { productId: 5, countedQuantity: 7, note: "Cajas rotas" }] });
  assert.deepEqual(ok.lines, [{ productId: 3, countedQuantity: 0 }, { productId: 4, countedQuantity: null, note: null }, { productId: 5, countedQuantity: 7, note: "Cajas rotas" }]);
  assert.deepEqual(paths400(() => parseSaveStockCountLines({ lines: [] })), ["lines"]);
  assert.deepEqual(paths400(() => parseSaveStockCountLines({ lines: [{ productId: 3, countedQuantity: -1 }] })), ["lines[0].countedQuantity"]);
  assert.deepEqual(paths400(() => parseSaveStockCountLines({ lines: [{ productId: 3, countedQuantity: 1.5 }] })), ["lines[0].countedQuantity"]);
  assert.deepEqual(paths400(() => parseSaveStockCountLines({ lines: [{ productId: 3 }] })), ["lines[0].countedQuantity"]);
  assert.deepEqual(paths400(() => parseSaveStockCountLines({ lines: [{ productId: 3, countedQuantity: 1 }, { productId: 3, countedQuantity: 2 }] })), ["lines[1].productId"]);
});

test("parseApplyStockCount: lista opcional de vencimientos por producto", () => {
  assert.deepEqual(parseApplyStockCount({}).surplusLots, []);
  assert.deepEqual(parseApplyStockCount(undefined).surplusLots, []);
  assert.deepEqual(parseApplyStockCount({ surplusLots: [{ productId: 9, expiresAt: "2027-03-01" }] }).surplusLots, [{ productId: 9, expiresAt: "2027-03-01" }]);
  assert.deepEqual(paths400(() => parseApplyStockCount({ surplusLots: [{ productId: 9 }] })), ["surplusLots[0].expiresAt"]);
  assert.deepEqual(paths400(() => parseApplyStockCount({ surplusLots: [{ productId: 9, expiresAt: "2027-03-01" }, { productId: 9, expiresAt: "2027-04-01" }] })), ["surplusLots[1].productId"]);
});

test("parseStockCountListFilter: estado conocido y fechas YYYY-MM-DD", () => {
  assert.deepEqual(parseStockCountListFilter({ status: "PLANNED", from: "2026-10-01", to: "2026-10-31" }), { status: "PLANNED", from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(parseStockCountListFilter({}), { status: undefined, from: undefined, to: undefined });
  assert.deepEqual(paths400(() => parseStockCountListFilter({ status: "OPEN", from: "ayer" })), ["status", "from"]);
});

// ---------------------------------------------------------------- reglas puras

test("countDifference: contado − esperado; null mientras no se cuente", () => {
  assert.equal(countDifference(20, 17), -3);
  assert.equal(countDifference(20, 23), 3);
  assert.equal(countDifference(5, 5), 0);
  assert.equal(countDifference(0, 4), 4);
  assert.equal(countDifference(12, null), null);
});

test("summarizeLines: pendientes, líneas con diferencia y unidades faltantes y sobrantes", () => {
  assert.deepEqual(
    summarizeLines([
      { countedQuantity: 13, difference: -8 },
      { countedQuantity: 23, difference: 3 },
      { countedQuantity: 5, difference: 0 },
      { countedQuantity: null, difference: null },
    ]),
    { totalLines: 4, countedLines: 3, pendingLines: 1, linesWithDifference: 2, shortageUnits: 8, surplusUnits: 3 },
  );
});

test("stockCountDue: atrasado, hoy o próximo solo mientras esté abierto", () => {
  assert.equal(stockCountDue("PLANNED", "2026-10-28", TODAY), "OVERDUE");
  assert.equal(stockCountDue("IN_PROGRESS", TODAY, TODAY), "TODAY");
  assert.equal(stockCountDue("PLANNED", "2026-10-30", TODAY), "UPCOMING");
  assert.equal(stockCountDue("SUBMITTED", "2026-10-01", TODAY), null);
  assert.equal(stockCountDue("CANCELLED", "2026-10-01", TODAY), null);
});

test("planFefoShortage: los vencidos salen primero aunque haya lotes con más unidades", () => {
  const plan = planFefoShortage(
    [
      { id: 10, quantityRemaining: 30, expiresAt: "2026-12-01" },
      { id: 11, quantityRemaining: 4, expiresAt: "2026-10-20" },
      { id: 12, quantityRemaining: 2, expiresAt: "2026-10-01" },
    ],
    5,
    TODAY,
  );
  assert.deepEqual(plan, [
    { productBatchId: 12, expiresAt: "2026-10-01", expired: true, quantity: 2 },
    { productBatchId: 11, expiresAt: "2026-10-20", expired: true, quantity: 3 },
  ]);
});

test("planFefoShortage: reparte entre varios lotes por vencimiento y, a igual fecha, por id; ignora lotes vacíos", () => {
  const plan = planFefoShortage(
    [
      { id: 8, quantityRemaining: 5, expiresAt: "2027-01-10" },
      { id: 3, quantityRemaining: 0, expiresAt: "2026-11-01" },
      { id: 6, quantityRemaining: 4, expiresAt: "2026-12-12" },
      { id: 5, quantityRemaining: 2, expiresAt: "2026-12-12" },
    ],
    9,
    TODAY,
  );
  assert.deepEqual(plan.map((t) => [t.productBatchId, t.quantity]), [[5, 2], [6, 4], [8, 3]]);
  assert.deepEqual(planFefoShortage([{ id: 1, quantityRemaining: 3, expiresAt: "2027-01-01" }], 0, TODAY), []);
});

test("planFefoShortage: un faltante mayor que lo que hay en lotes → 714", () => {
  assert.equal(codeOf(() => planFefoShortage([{ id: 1, quantityRemaining: 3, expiresAt: "2026-10-01" }, { id: 2, quantityRemaining: 2, expiresAt: "2027-01-01" }], 6, TODAY)), "714");
  assert.equal(codeOf(() => planFefoShortage([], 1, TODAY)), "714");
});

test("canTransition: cada acción desde su estado y con su rol; aplicar solo ADMIN", () => {
  const cases: [Parameters<typeof canTransition>[0], StockCountAction, Parameters<typeof canTransition>[2], boolean][] = [
    ["PLANNED", "update", "WAREHOUSE", true],
    ["IN_PROGRESS", "update", "ADMIN", false],
    ["PLANNED", "start", "WAREHOUSE", true],
    ["IN_PROGRESS", "start", "ADMIN", false],
    ["IN_PROGRESS", "saveLines", "WAREHOUSE", true],
    ["SUBMITTED", "saveLines", "ADMIN", false],
    ["IN_PROGRESS", "submit", "WAREHOUSE", true],
    ["PLANNED", "submit", "ADMIN", false],
    ["SUBMITTED", "apply", "ADMIN", true],
    ["SUBMITTED", "apply", "WAREHOUSE", false],
    ["IN_PROGRESS", "apply", "ADMIN", false],
    ["APPLIED", "apply", "ADMIN", false],
    ["PLANNED", "cancel", "WAREHOUSE", true],
    ["IN_PROGRESS", "cancel", "ADMIN", true],
    ["SUBMITTED", "cancel", "ADMIN", false],
    ["APPLIED", "cancel", "ADMIN", false],
    ["CANCELLED", "cancel", "ADMIN", false],
  ];
  for (const [status, action, role, expected] of cases) assert.equal(canTransition(status, action, role), expected, `${action} desde ${status} como ${role}`);
  // La secretaria no participa en ningún paso.
  for (const action of ["update", "start", "saveLines", "submit", "apply", "cancel"] as const) {
    for (const status of ["PLANNED", "IN_PROGRESS", "SUBMITTED", "APPLIED", "CANCELLED"] as const) assert.equal(canTransition(status, action, "SALES"), false);
  }
});

test("assertTransition: 613 si el rol no puede nunca, 711 si el estado no lo permite", () => {
  assert.equal(codeOf(() => assertTransition("SUBMITTED", "apply", "WAREHOUSE")), "613");
  assert.equal(codeOf(() => assertTransition("APPLIED", "apply", "ADMIN")), "711");
  assert.equal(codeOf(() => assertTransition("SUBMITTED", "cancel", "WAREHOUSE")), "711");
  assert.equal(codeOf(() => assertTransition("PLANNED", "start", "WAREHOUSE")), undefined);
});

// ---------------------------------------------------------------- endpoints (sin base de datos)

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler }[] } };

/** Manejadores de una ruta del router: [authorize, controlador]. */
const handlersOf = (method: string, path: string): RequestHandler[] => {
  const layer = (stockCountsRouter.stack as unknown as Layer[]).find((l) => l.route?.path === path && l.route.methods[method] === true);
  assert.ok(layer?.route, `falta ${method.toUpperCase()} ${path}`);
  return layer.route.stack.map((s) => s.handle);
};

const fakeReq = (parts: { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown }): Request =>
  ({ params: parts.params ?? {}, query: parts.query ?? {}, body: parts.body, headers: {} }) as unknown as Request;

const fakeRes = { status() { return this; }, json() { return this; }, send() { return this; } } as unknown as Response;

/** El controlador rechaza la petición (sin tocar la base) con el código esperado. */
const rejectsWith = async (handler: RequestHandler, req: Request, code: string) => {
  await assert.rejects(Promise.resolve().then(() => handler(req, fakeRes, () => undefined)), (err: unknown) => isDomainError(err) && err.code === code);
};

/** Toda ruta pasa por authorize antes del controlador: sin identidad responde 611. */
const guarded = async (method: string, path: string, controller: RequestHandler) => {
  const handlers = handlersOf(method, path);
  assert.equal(handlers.length, 2, "authorize + controlador");
  assert.equal(handlers[1], controller);
  await rejectsWith(handlers[0]!, fakeReq({}), "611");
};

test("GET /stock-counts: protegido y valida estado y fechas", async () => {
  await guarded("get", "/", controllers.listStockCountsController);
  await rejectsWith(controllers.listStockCountsController, fakeReq({ query: { status: "ABIERTO" } }), "400");
});

test("POST /stock-counts: protegido y exige identidad antes de programar", async () => {
  await guarded("post", "/", controllers.createStockCountController);
  await rejectsWith(controllers.createStockCountController, fakeReq({ body: { title: "x", scheduledDate: TODAY } }), "611");
});

test("GET /stock-counts/:id: protegido y el id debe ser entero positivo", async () => {
  await guarded("get", "/:id", controllers.getStockCountController);
  await rejectsWith(controllers.getStockCountController, fakeReq({ params: { id: "abc" } }), "400");
});

test("PUT /stock-counts/:id: protegido y valida el id", async () => {
  await guarded("put", "/:id", controllers.updateStockCountController);
  await rejectsWith(controllers.updateStockCountController, fakeReq({ params: { id: "0" }, body: { title: "x" } }), "400");
});

test("POST /stock-counts/:id/start: protegido y valida el id", async () => {
  await guarded("post", "/:id/start", controllers.startStockCountController);
  await rejectsWith(controllers.startStockCountController, fakeReq({ params: { id: "-1" } }), "400");
});

test("PUT /stock-counts/:id/lines: protegido y valida el id", async () => {
  await guarded("put", "/:id/lines", controllers.saveStockCountLinesController);
  await rejectsWith(controllers.saveStockCountLinesController, fakeReq({ params: { id: "x" }, body: { lines: [] } }), "400");
});

test("POST /stock-counts/:id/submit: protegido y valida el id", async () => {
  await guarded("post", "/:id/submit", controllers.submitStockCountController);
  await rejectsWith(controllers.submitStockCountController, fakeReq({ params: { id: "1.5" } }), "400");
});

test("GET /stock-counts/:id/preview-adjustment: protegido y valida el id", async () => {
  await guarded("get", "/:id/preview-adjustment", controllers.previewAdjustmentController);
  await rejectsWith(controllers.previewAdjustmentController, fakeReq({ params: { id: "" } }), "400");
});

test("POST /stock-counts/:id/apply: protegido (solo ADMIN) y valida el id", async () => {
  await guarded("post", "/:id/apply", controllers.applyStockCountController);
  await rejectsWith(controllers.applyStockCountController, fakeReq({ params: { id: "nada" }, body: {} }), "400");
});

test("POST /stock-counts/:id/cancel: protegido y valida el id", async () => {
  await guarded("post", "/:id/cancel", controllers.cancelStockCountController);
  await rejectsWith(controllers.cancelStockCountController, fakeReq({ params: { id: "0" } }), "400");
});
