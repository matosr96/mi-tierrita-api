import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signAccessToken, verifyAccessToken } from "../src/security/token";
import { isDomainError } from "../src/common/errors";

test("un token firmado se verifica y conserva sub, rol y versión", () => {
  const token = signAccessToken({ sub: "7", role: "SALES", tv: 3 });
  assert.deepEqual(verifyAccessToken(token), { sub: "7", role: "SALES", tv: 3 });
});

test("un token manipulado responde con el código 611", () => {
  const token = signAccessToken({ sub: "7", role: "SALES", tv: 3 });
  assert.throws(() => verifyAccessToken(token.slice(0, -2) + "xx"), (err: unknown) => isDomainError(err) && err.code === "611");
  assert.throws(() => verifyAccessToken("no-es-un-jwt"), (err: unknown) => isDomainError(err) && err.code === "611");
});
