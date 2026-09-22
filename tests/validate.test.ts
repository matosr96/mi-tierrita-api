import { test } from "node:test";
import assert from "node:assert/strict";
import { parseId, validate } from "../src/common/validate.js";
import { createUserSchema, signinSchema } from "../src/models/users.js";
import { isDomainError } from "../src/common/errors.js";

test("validate devuelve los datos limpios cuando la forma es correcta", () => {
  assert.deepEqual(validate(signinSchema, { username: "  admin ", password: "x" }), { username: "admin", password: "x" });
});

test("validate responde 400 con la lista de campos inválidos", () => {
  assert.throws(
    () => validate(createUserSchema, { firstName: "", username: "a", password: "corta", role: "JEFE" }),
    (err: unknown) => {
      if (!isDomainError(err) || err.code !== "400") return false;
      const paths = (err.details as { path: string }[]).map((d) => d.path);
      return ["firstName", "lastName", "username", "password", "role"].every((p) => paths.includes(p));
    },
  );
});

test("parseId acepta enteros positivos y rechaza el resto", () => {
  assert.equal(parseId("12"), 12);
  for (const bad of ["0", "-1", "1.5", "abc", undefined]) {
    assert.throws(() => parseId(bad), (err: unknown) => isDomainError(err) && err.code === "400");
  }
});
