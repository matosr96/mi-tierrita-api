import { test } from "node:test";
import assert from "node:assert/strict";
import { createValidator, isIsoDate, parseId, queryBoolean, queryId } from "../src/common/validate";
import { parseCreateUser, parseSignin } from "../src/models/users";
import { parseCreateSale } from "../src/models/sales";
import { isDomainError } from "../src/common/errors";

const is400 = (err: unknown): err is { details: { path: string }[] } => isDomainError(err) && err.code === "400";

test("parseSignin devuelve los datos limpios cuando la forma es correcta", () => {
  assert.deepEqual(parseSignin({ username: "  admin ", password: "x" }), { username: "admin", password: "x" });
});

test("parseCreateUser responde 400 con la lista de campos inválidos", () => {
  assert.throws(
    () => parseCreateUser({ firstName: "", username: "a", password: "corta", role: "JEFE" }),
    (err: unknown) => {
      if (!is400(err)) return false;
      const paths = err.details.map((d) => d.path);
      return ["firstName", "lastName", "username", "password", "role"].every((p) => paths.includes(p));
    },
  );
});

test("un body que no es objeto responde 400", () => {
  assert.throws(() => parseSignin("texto"), is400);
  assert.throws(() => parseSignin(null), is400);
});

test("parseCreateSale valida líneas anidadas y exige cliente en crédito", () => {
  const ok = parseCreateSale({ lines: [{ productId: 1, quantity: 2 }] });
  assert.equal(ok.paymentType, "CASH");
  assert.deepEqual(ok.lines, [{ productId: 1, quantity: 2 }]);
  assert.throws(
    () => parseCreateSale({ paymentType: "CREDIT", lines: [{ productId: 1, quantity: 0 }, { quantity: 1 }] }),
    (err: unknown) => is400(err) && ["lines[0].quantity", "lines[1].productId", "customerId"].every((p) => err.details.some((d) => d.path === p)),
  );
  assert.throws(() => parseCreateSale({ lines: [] }), is400);
});

test("reglas numéricas: entero, rango y decimales", () => {
  const v = createValidator({ a: 1.5, b: 2, c: 1.234, d: "x" });
  assert.equal(v.number("a", { integer: true }), undefined);
  assert.equal(v.number("b", { min: 3 }), undefined);
  assert.equal(v.number("c", { decimals: 2 }), undefined);
  assert.equal(v.number("d"), undefined);
  assert.equal(v.number("e", {}, false), undefined);
  assert.equal(v.issues().length, 4);
  assert.throws(() => v.done(), is400);
});

test("fechas ISO y parámetros de query", () => {
  assert.ok(isIsoDate("2026-09-22"));
  assert.equal(isIsoDate("22/09/2026"), false);
  assert.equal(isIsoDate("2026-13-45"), false);
  assert.equal(queryId("12"), 12);
  assert.equal(queryId("abc"), undefined);
  assert.equal(queryBoolean("true"), true);
  assert.equal(queryBoolean("si"), undefined);
});

test("parseId acepta enteros positivos y rechaza el resto", () => {
  assert.equal(parseId("12"), 12);
  for (const bad of ["0", "-1", "1.5", "abc", undefined]) {
    assert.throws(() => parseId(bad), is400);
  }
});
