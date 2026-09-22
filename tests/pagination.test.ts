import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePageRequest, toPageResponse, DEFAULT_LIMIT, MAX_LIMIT } from "../src/common/pagination";

test("page y limit por defecto", () => {
  assert.deepEqual(parsePageRequest({}), { page: 1, limit: DEFAULT_LIMIT, offset: 0 });
});

test("page y limit válidos calculan el offset", () => {
  assert.deepEqual(parsePageRequest({ page: "3", limit: "20" }), { page: 3, limit: 20, offset: 40 });
});

test("valores inválidos vuelven al defecto y limit respeta el tope", () => {
  assert.equal(parsePageRequest({ page: "0" }).page, 1);
  assert.equal(parsePageRequest({ page: "abc" }).page, 1);
  assert.equal(parsePageRequest({ limit: "-5" }).limit, DEFAULT_LIMIT);
  assert.equal(parsePageRequest({ limit: "9999" }).limit, MAX_LIMIT);
});

test("respuesta con el contrato { count, page, pages, items }", () => {
  const req = parsePageRequest({ page: "2", limit: "10" });
  assert.deepEqual(toPageResponse(req, 25, ["a"]), { count: 25, page: 2, pages: 3, items: ["a"] });
  assert.deepEqual(toPageResponse(req, 0, []), { count: 0, page: 2, pages: 0, items: [] });
});
