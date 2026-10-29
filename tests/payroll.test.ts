import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, RequestHandler, Response } from "express";
import { isDomainError } from "../src/common/errors";
import {
  parseCreatePayrollEmployee,
  parseCreatePayrollPeriod,
  parsePayrollEmployeeQuery,
  parsePayrollPeriodQuery,
  parseUpdatePayrollEmployee,
  parseUpdatePayrollLine,
  toPayrollPeriodResponse,
  type PayrollPeriodRow,
} from "../src/models/payroll";
import { HEALTH_EMPLOYEE_PERCENT, PENSION_EMPLOYEE_PERCENT, liquidateLine, prorateBase } from "../src/business-logic/payroll/liquidate";
import { canApprovePeriod, canPayPeriod, isPeriodEditable } from "../src/business-logic/payroll/period-status";
import { payrollRouter } from "../src/routes/payroll";

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

const zero = { overtime: 0, bonuses: 0, transport: 0, otherDeductions: 0 };

// ------------------------------------------------------------------ liquidación

test("liquidateLine: salud 4 % y pensión 4 % sobre el salario base del periodo", () => {
  assert.equal(HEALTH_EMPLOYEE_PERCENT, 4);
  assert.equal(PENSION_EMPLOYEE_PERCENT, 4);
  assert.deepEqual(liquidateLine({ base: 1_000_000, ...zero }), { health: 40_000, pension: 40_000, gross: 1_000_000, deductions: 80_000, net: 920_000 });
});

test("liquidateLine: las horas extra cotizan; bonificaciones y auxilio de transporte no", () => {
  const r = liquidateLine({ base: 800_000, overtime: 100_000, bonuses: 50_000, transport: 90_000, otherDeductions: 0 });
  assert.equal(r.health, 36_000, "4 % de 900.000");
  assert.equal(r.pension, 36_000);
  assert.equal(r.gross, 1_040_000);
  assert.equal(r.deductions, 72_000);
  assert.equal(r.net, 968_000);
  // El auxilio suma al devengado pero no cambia salud ni pensión.
  const sinAuxilio = liquidateLine({ base: 800_000, overtime: 100_000, bonuses: 50_000, transport: 0, otherDeductions: 0 });
  assert.equal(sinAuxilio.health, r.health);
  assert.equal(sinAuxilio.pension, r.pension);
  assert.equal(r.gross - sinAuxilio.gross, 90_000);
});

test("liquidateLine: redondea a pesos enteros", () => {
  const r = liquidateLine({ base: 711_751, ...zero });
  assert.equal(r.health, 28_470, "28.470,04 → 28.470");
  assert.equal(r.pension, 28_470);
  assert.equal(r.net, 711_751 - 56_940);
  const conCentavos = liquidateLine({ base: 1_000_000.4, overtime: 12_345.6, bonuses: 0.5, transport: 0, otherDeductions: 0.49 });
  for (const value of Object.values(conCentavos)) assert.ok(Number.isInteger(value), `${value} debe ser entero`);
  assert.equal(conCentavos.gross, 1_000_000 + 12_346 + 1);
});

test("liquidateLine: otros descuentos restan del neto sin cambiar salud ni pensión", () => {
  const r = liquidateLine({ base: 1_000_000, overtime: 0, bonuses: 0, transport: 0, otherDeductions: 150_000 });
  assert.equal(r.health, 40_000);
  assert.equal(r.deductions, 230_000);
  assert.equal(r.net, 770_000);
  assert.ok(liquidateLine({ base: 100, overtime: 0, bonuses: 0, transport: 0, otherDeductions: 1_000 }).net < 0, "el servidor rechaza un neto negativo");
});

test("prorateBase: quincenal es la mitad del mensual, redondeada a pesos", () => {
  assert.equal(prorateBase(1_500_000, "MONTHLY"), 1_500_000);
  assert.equal(prorateBase(1_500_000, "BIWEEKLY"), 750_000);
  assert.equal(prorateBase(1_423_501, "BIWEEKLY"), 711_751, "711.750,5 → 711.751");
  assert.equal(prorateBase(1_200_000.6, "MONTHLY"), 1_200_001);
});

// ------------------------------------------------------------------ estados

test("solo un borrador se edita o se elimina; solo un borrador se aprueba y solo uno aprobado se paga", () => {
  assert.equal(isPeriodEditable("DRAFT"), true);
  assert.equal(isPeriodEditable("APPROVED"), false);
  assert.equal(isPeriodEditable("PAID"), false);
  assert.equal(canApprovePeriod("DRAFT"), true);
  assert.equal(canApprovePeriod("APPROVED"), false);
  assert.equal(canPayPeriod("APPROVED"), true);
  assert.equal(canPayPeriod("DRAFT"), false);
  assert.equal(canPayPeriod("PAID"), false);
  const row: PayrollPeriodRow = {
    id: 1, frequency: "BIWEEKLY", periodStart: "2026-11-01", periodEnd: "2026-11-15", payDate: "2026-11-15", status: "APPROVED",
    totalGross: 0, totalDeductions: 0, totalNet: 0, employeeCount: 0, createdBy: { id: 1, firstName: "A", lastName: "B" },
    approvedBy: null, paidBy: null, approvedAt: new Date("2026-11-14T15:00:00Z"), paidAt: null, createdAt: new Date("2026-11-01T15:00:00Z"),
  };
  assert.equal(toPayrollPeriodResponse(row).editable, false);
  assert.equal(toPayrollPeriodResponse({ ...row, status: "DRAFT", approvedAt: null }).editable, true);
});

// ------------------------------------------------------------------ parsers

test("parseCreatePayrollEmployee exige nombre, documento, cargo, salario y frecuencia", () => {
  const ok = parseCreatePayrollEmployee({ firstName: " Ana ", lastName: "Ruiz", documentId: "1.067.000", position: "Vendedora", baseSalary: 1_500_000, payFrequency: "BIWEEKLY" });
  assert.equal(ok.firstName, "Ana");
  assert.equal(ok.userId, undefined);
  assert.deepEqual(paths400(() => parseCreatePayrollEmployee({})), ["firstName", "lastName", "documentId", "position", "baseSalary", "payFrequency"]);
  assert.deepEqual(
    paths400(() => parseCreatePayrollEmployee({ firstName: "A", lastName: "B", documentId: "12 34", position: "x", baseSalary: 0, payFrequency: "WEEKLY", userId: 0 })),
    ["documentId", "baseSalary", "payFrequency", "userId"],
  );
});

test("parseUpdatePayrollEmployee: parcial, null desvincula la cuenta y nada vacío", () => {
  assert.deepEqual(parseUpdatePayrollEmployee({ active: false }).active, false);
  assert.equal(parseUpdatePayrollEmployee({ userId: null }).userId, null);
  assert.deepEqual(paths400(() => parseUpdatePayrollEmployee({})), ["body"]);
  assert.deepEqual(paths400(() => parseUpdatePayrollEmployee({ baseSalary: -5 })), ["baseSalary"]);
});

test("parseCreatePayrollPeriod: fechas válidas y fin igual o posterior al inicio", () => {
  const ok = parseCreatePayrollPeriod({ frequency: "BIWEEKLY", periodStart: "2026-11-01", periodEnd: "2026-11-15", payDate: "2026-11-15" });
  assert.equal(ok.frequency, "BIWEEKLY");
  assert.deepEqual(parseCreatePayrollPeriod({ frequency: "MONTHLY", periodStart: "2026-11-01", periodEnd: "2026-11-01", payDate: "2026-10-30" }).periodEnd, "2026-11-01");
  assert.deepEqual(paths400(() => parseCreatePayrollPeriod({ frequency: "BIWEEKLY", periodStart: "2026-11-15", periodEnd: "2026-11-01", payDate: "2026-11-15" })), ["periodEnd"]);
  assert.deepEqual(paths400(() => parseCreatePayrollPeriod({ frequency: "BIWEEKLY", periodStart: "2026-11-01", periodEnd: "2026-11-15", payDate: "15/11/2026" })), ["payDate"]);
  assert.deepEqual(paths400(() => parseCreatePayrollPeriod({})), ["frequency", "periodStart", "periodEnd", "payDate"]);
});

test("parseUpdatePayrollLine: solo valores no negativos de lo que se escribe a mano", () => {
  assert.deepEqual(parseUpdatePayrollLine({ overtime: 120_000 }), { overtime: 120_000, bonuses: undefined, transport: undefined, otherDeductions: undefined });
  assert.deepEqual(paths400(() => parseUpdatePayrollLine({})), ["body"]);
  assert.deepEqual(paths400(() => parseUpdatePayrollLine({ overtime: -1, bonuses: "5", transport: 1.234 })), ["overtime", "bonuses", "transport"]);
  // Los totales que envíe el cliente se ignoran: no son campos de entrada.
  assert.deepEqual(paths400(() => parseUpdatePayrollLine({ net: 5 })), ["body"]);
});

test("filtros de listados: un valor inválido se ignora", () => {
  assert.deepEqual(parsePayrollPeriodQuery({ status: "PAID", year: "2026" }), { status: "PAID", year: 2026 });
  assert.deepEqual(parsePayrollPeriodQuery({ status: "x", year: "26" }), { status: undefined, year: undefined });
  assert.deepEqual(parsePayrollEmployeeQuery({ active: "true", frequency: "MONTHLY" }), { active: true, frequency: "MONTHLY" });
  assert.deepEqual(parsePayrollEmployeeQuery({ active: "si", frequency: "WEEKLY" }), { active: undefined, frequency: undefined });
});

// ------------------------------------------------------------------ endpoints (sin base de datos)

type RouteLayer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler }[] } };

const findRoute = (method: string, path: string) => {
  const layer = (payrollRouter.stack as unknown as RouteLayer[]).find((l) => l.route?.path === path && l.route.methods[method] === true);
  assert.ok(layer?.route, `${method.toUpperCase()} ${path} debe existir`);
  return layer.route.stack.map((s) => s.handle);
};

/** Petición con identidad: `getAuth` lee una propiedad con símbolo privado; el Proxy responde a cualquier símbolo. */
const fakeRequest = (role: string, extra: Partial<Request> = {}): Request =>
  new Proxy({ params: {}, query: {}, body: {}, ...extra } as Request, {
    get: (target, key) => (typeof key === "symbol" ? { userId: 1, username: "prueba", role } : (target as unknown as Record<string, unknown>)[key]),
  });

const runGuard = (guard: RequestHandler, role: string): { code?: string; requiredRoles?: string[]; passed: boolean } => {
  let passed = false;
  try {
    void guard(fakeRequest(role), {} as Response, () => {
      passed = true;
    });
  } catch (err) {
    if (isDomainError(err)) return { code: err.code, requiredRoles: (err.details as { requiredRoles: string[] }).requiredRoles, passed };
    throw err;
  }
  return { passed };
};

const rejects400 = async (handler: RequestHandler, req: Partial<Request>): Promise<string[]> => {
  try {
    await handler(fakeRequest("ADMIN", req), { status: () => ({ json: () => undefined }), json: () => undefined } as unknown as Response, () => undefined);
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
    throw err;
  }
  return [];
};

const ENDPOINTS: { method: string; path: string; invalid?: Partial<Request>; expect?: string[] }[] = [
  { method: "get", path: "/employees" },
  { method: "post", path: "/employees", invalid: { body: { firstName: "Ana" } }, expect: ["lastName", "documentId", "position", "baseSalary", "payFrequency"] },
  { method: "put", path: "/employees/:id", invalid: { params: { id: "abc" } }, expect: ["id"] },
  { method: "get", path: "/periods" },
  { method: "post", path: "/periods", invalid: { body: { frequency: "BIWEEKLY", periodStart: "2026-11-15", periodEnd: "2026-11-01", payDate: "2026-11-15" } }, expect: ["periodEnd"] },
  { method: "get", path: "/periods/:id", invalid: { params: { id: "0" } }, expect: ["id"] },
  { method: "put", path: "/periods/:id/lines/:lineId", invalid: { params: { id: "3", lineId: "x" } }, expect: ["lineId"] },
  { method: "post", path: "/periods/:id/approve", invalid: { params: { id: "-1" } }, expect: ["id"] },
  { method: "post", path: "/periods/:id/pay", invalid: { params: { id: "1.5" } }, expect: ["id"] },
  { method: "delete", path: "/periods/:id", invalid: { params: { id: "abc" } }, expect: ["id"] },
];

for (const endpoint of ENDPOINTS) {
  test(`${endpoint.method.toUpperCase()} /payroll${endpoint.path}: solo ADMIN; Secretaria y Bodega reciben 613`, async () => {
    const [guard, controller] = findRoute(endpoint.method, endpoint.path);
    assert.ok(guard && controller);
    assert.equal(runGuard(guard, "ADMIN").passed, true);
    for (const role of ["SALES", "WAREHOUSE"]) {
      const result = runGuard(guard, role);
      assert.equal(result.code, "613", role);
      assert.deepEqual(result.requiredRoles, ["ADMIN"]);
      assert.equal(result.passed, false);
    }
    if (endpoint.invalid) assert.deepEqual(await rejects400(controller, endpoint.invalid), endpoint.expect);
  });
}

test("el router de nómina no expone rutas sin probar", () => {
  const declared = (payrollRouter.stack as unknown as RouteLayer[]).flatMap((l) => (l.route ? Object.keys(l.route.methods).map((m) => `${m} ${l.route!.path}`) : []));
  assert.deepEqual(declared.sort(), ENDPOINTS.map((e) => `${e.method} ${e.path}`).sort());
});
