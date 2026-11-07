import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { MAX_TAGS, parseCreateCategory, parseUpdateCategory, toCategoryResponse, toPublicCategoryResponse } from "../src/models/categories";
import { PRODUCT_LINES } from "../src/business-logic/categories/product-lines";
import { demoCategories, demoLines, demoProducts } from "../src/scripts/seed-data";

/** Líneas de producto iguales en la página pública y en el sistema (6/11/2026): migración 0018 y `GET /categories/public`. */

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

test("PRODUCT_LINES: seis líneas con código 01…06 único, nombre único y subfamilias no vacías", () => {
  assert.equal(PRODUCT_LINES.length, 6);
  assert.deepEqual(
    PRODUCT_LINES.map((l) => l.code),
    ["01", "02", "03", "04", "05", "06"],
  );
  assert.equal(new Set(PRODUCT_LINES.map((l) => l.name.toLowerCase())).size, 6);
  for (const l of PRODUCT_LINES) {
    assert.ok(l.name.length >= 1 && l.name.length <= 80, l.name);
    assert.ok(l.description.length >= 1 && l.description.length <= 200, l.code);
    assert.ok(l.tags.length >= 1 && l.tags.length <= MAX_TAGS, l.code);
    assert.equal(new Set(l.tags).size, l.tags.length, l.code);
  }
  assert.equal(PRODUCT_LINES[4]!.name, "Productos agroquímicos");
});

test("la semilla usa exactamente las seis líneas de la página pública y cada producto demo cae en una", () => {
  assert.deepEqual(demoLines(), PRODUCT_LINES);
  assert.deepEqual(
    demoCategories(),
    PRODUCT_LINES.map((l) => l.name),
  );
  const names = new Set(demoCategories());
  for (const p of demoProducts()) assert.ok(names.has(p.category), `${p.sku} en ${p.category}`);
  for (const name of names) assert.ok(demoProducts().some((p) => p.category === name), `sin productos: ${name}`);
});

test("toPublicCategoryResponse expone solo código, nombre, descripción y subfamilias", () => {
  const row = { id: 11, name: "Aves de corral", code: "04", description: "Pollitas ponedoras y pollos de engorde.", tags: ["Ponedoras", "Engorde"], active: true, createdAt: new Date("2026-06-19T00:00:00Z") };
  assert.deepEqual(toPublicCategoryResponse(row), { code: "04", name: "Aves de corral", description: "Pollitas ponedoras y pollos de engorde.", tags: ["Ponedoras", "Engorde"] });
  assert.deepEqual(Object.keys(toPublicCategoryResponse(row)).sort(), ["code", "description", "name", "tags"]);
  const full = toCategoryResponse(row);
  assert.equal(full.code, "04");
  assert.equal(full.createdAt, "2026-06-19T00:00:00.000Z");
});

test("parseCreateCategory: nombre obligatorio; descripción y subfamilias opcionales, recortadas y sin repetidos", () => {
  assert.deepEqual(parseCreateCategory({ name: " Lácteos " }), { name: "Lácteos", description: undefined, tags: undefined });
  assert.deepEqual(parseCreateCategory({ name: "Lácteos", description: " Leche y quesos ", tags: [" Leche ", "Quesos"] }), { name: "Lácteos", description: "Leche y quesos", tags: ["Leche", "Quesos"] });
  assert.deepEqual(paths400(() => parseCreateCategory({})), ["name"]);
  assert.deepEqual(paths400(() => parseCreateCategory({ name: "X", tags: "Leche" })), ["tags"]);
  assert.deepEqual(paths400(() => parseCreateCategory({ name: "X", tags: ["Leche", "leche", "", 3] })), ["tags[1]", "tags[2]", "tags[3]"]);
  assert.deepEqual(paths400(() => parseCreateCategory({ name: "X", tags: Array.from({ length: MAX_TAGS + 1 }, (_, i) => `T${i}`) })), ["tags"]);
  assert.deepEqual(paths400(() => parseCreateCategory({ name: "X", description: "d".repeat(201) })), ["description"]);
});

test("parseUpdateCategory: al menos un campo; description null borra; tags [] vacía la lista", () => {
  assert.deepEqual(paths400(() => parseUpdateCategory({})), ["body"]);
  assert.deepEqual(parseUpdateCategory({ description: null }), { name: undefined, active: undefined, description: null, tags: undefined });
  assert.deepEqual(parseUpdateCategory({ tags: [] }), { name: undefined, active: undefined, description: undefined, tags: [] });
  assert.deepEqual(parseUpdateCategory({ name: "Aves", active: false }), { name: "Aves", active: false, description: undefined, tags: undefined });
});
