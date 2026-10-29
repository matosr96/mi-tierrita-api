import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { parseCreateReportExport, parseFolio } from "../src/models/exports";
import { exportHash, nextFolio } from "../src/business-logic/reports/record-export";

/** Brief de octubre de 2026, sección 2.4 (puntos 25 y 26): folio, hash y filtros estructurados del historial. */

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

test("parseCreateReportExport acepta filters y summary de escalares y los deja vacíos si no vienen", () => {
  const full = parseCreateReportExport({ report: "sales", format: "pdf", description: "Del 1 al 30", filters: { from: "2026-10-01", to: "2026-10-30", groupBy: "day" }, summary: { total: 1250000.5, salesCount: 12, overdue: false, note: null } });
  assert.deepEqual(full.filters, { from: "2026-10-01", to: "2026-10-30", groupBy: "day" });
  assert.deepEqual(full.summary, { total: 1250000.5, salesCount: 12, overdue: false, note: null });
  const bare = parseCreateReportExport({ report: "inventory", format: "xlsx", description: "Corte" });
  assert.deepEqual(bare.filters, {});
  assert.deepEqual(bare.summary, {});
});

test("parseCreateReportExport rechaza filtros que no sean escalares o no sean un objeto", () => {
  assert.deepEqual(paths400(() => parseCreateReportExport({ report: "sales", format: "pdf", description: "x", filters: { rows: [1, 2] } })), ["filters.rows"]);
  assert.deepEqual(paths400(() => parseCreateReportExport({ report: "sales", format: "pdf", description: "x", summary: "texto" })), ["summary"]);
});

test("nextFolio arma R-AAAA-NNNNNN con el consecutivo a seis cifras", () => {
  assert.equal(nextFolio(2026, 7), "R-2026-000007");
  assert.equal(nextFolio(2027, 123456), "R-2027-123456");
});

test("exportHash es determinista, no depende del orden de las claves y cambia con cualquier dato", () => {
  const base = { report: "sales", format: "pdf", filters: { from: "2026-10-01", to: "2026-10-30" }, summary: { total: 100 }, createdAt: "2026-10-29T15:00:00.000Z", userId: 3 };
  const h1 = exportHash(base);
  const h2 = exportHash({ ...base, filters: { to: "2026-10-30", from: "2026-10-01" } });
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.equal(h1, h2);
  assert.notEqual(h1, exportHash({ ...base, summary: { total: 101 } }));
  assert.notEqual(h1, exportHash({ ...base, userId: 4 }));
});

test("parseFolio exige el formato R-AAAA-NNNNNN y normaliza a mayúsculas", () => {
  assert.equal(parseFolio(" r-2026-000012 "), "R-2026-000012");
  assert.deepEqual(paths400(() => parseFolio("2026-12")), ["folio"]);
  assert.deepEqual(paths400(() => parseFolio(undefined)), ["folio"]);
  assert.deepEqual(paths400(() => parseFolio("R-2026-12; DROP TABLE")), ["folio"]);
});
