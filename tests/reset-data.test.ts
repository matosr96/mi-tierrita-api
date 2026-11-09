import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KEEP_TABLES, planTruncate } from "../src/scripts/reset-data";

/** Reinicio de datos (9/11/2026): qué tablas se conservan y cuáles se vacían. */

test("KEEP_TABLES conserva cuentas, roles y los controles de migraciones y reinicios", () => {
  assert.deepEqual([...KEEP_TABLES].sort(), ["data_resets", "roles", "schema_migrations", "users"]);
});

test("planTruncate quita las conservadas, deduplica y ordena", () => {
  const plan = planTruncate(["sales", "users", "products", "roles", "sales", "schema_migrations", "data_resets", "audits"]);
  assert.deepEqual(plan, ["audits", "products", "sales"]);
  for (const t of KEEP_TABLES) assert.ok(!plan.includes(t));
});

test("planTruncate con solo tablas conservadas no vacía nada", () => {
  assert.deepEqual(planTruncate([...KEEP_TABLES]), []);
});
