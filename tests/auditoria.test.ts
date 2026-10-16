import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { isDomainError } from "../src/common/errors";
import { todayIso } from "../src/common/dates";
import { registerBatch } from "../src/business-logic/batches/register-batch";
import { salesReportController } from "../src/controllers/reports/sales-report";

/** Hallazgos de la auditoría de octubre de 2026 (docs/auditoria en mi-tierrita-app). */

test("AUD-01: 'hoy' se cuenta en hora de Colombia, no en UTC", () => {
  // 8:30 p. m. del 16 de octubre en Bogotá = 01:30 UTC del 17
  assert.equal(todayIso(new Date("2026-10-17T01:30:00Z")), "2026-10-16");
  // 7:00 a. m. del 17 en Bogotá
  assert.equal(todayIso(new Date("2026-10-17T12:00:00Z")), "2026-10-17");
});

test("AUD-03: un lote que ya llega vencido responde 400 sin tocar la base", async () => {
  await assert.rejects(
    registerBatch({ productId: 1, quantity: 5, expiresAt: "2020-01-01" }),
    (err: unknown) => isDomainError(err) && err.code === "400" && JSON.stringify(err.details).includes("expiresAt"),
  );
});

test("AUD-04: el reporte de ventas rechaza un rango con 'from' posterior a 'to'", async () => {
  const req = { query: { from: "2026-10-20", to: "2026-10-01" } } as unknown as Request;
  const res = { json: () => assert.fail("no debía responder 200") } as unknown as Response;
  await assert.rejects(
    Promise.resolve(salesReportController(req, res, () => undefined)),
    (err: unknown) => isDomainError(err) && err.code === "400",
  );
});
