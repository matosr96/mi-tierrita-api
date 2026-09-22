import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError, ErrorCodes, domainError, httpStatusByCode, isDomainError } from "../src/common/errors";

test("cada código de dominio tiene un estado HTTP y viaja como message", () => {
  for (const code of Object.values(ErrorCodes)) {
    const err = domainError(code);
    assert.ok(isDomainError(err));
    assert.equal(err.message, code);
    assert.equal(err.status, httpStatusByCode[code]);
  }
});

test("códigos semilla del documento de requisitos", () => {
  assert.equal(httpStatusByCode[ErrorCodes.PRODUCT_NOT_FOUND], 404);
  assert.equal(httpStatusByCode[ErrorCodes.INVALID_CREDENTIALS], 401);
  assert.equal(httpStatusByCode[ErrorCodes.ROLE_INSUFFICIENT], 403);
  assert.equal(httpStatusByCode[ErrorCodes.STOCK_INSUFFICIENT], 409);
  assert.equal(httpStatusByCode[ErrorCodes.CREDIT_LIMIT_EXCEEDED], 409);
  assert.equal(httpStatusByCode[ErrorCodes.DUPLICATE_RESOURCE], 409);
  assert.equal(httpStatusByCode[ErrorCodes.TOO_MANY_ATTEMPTS], 429);
  assert.equal(httpStatusByCode[ErrorCodes.INVALID_SCENARIO], 422);
});

test("un Error común no es error de dominio", () => {
  assert.equal(isDomainError(new Error("601")), false);
  assert.ok(new DomainError(ErrorCodes.INTERNAL) instanceof Error);
});
