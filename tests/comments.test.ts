import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { canDeleteComment, canSeeEntity } from "../src/business-logic/comments/comment-access";
import { parseCommentsQuery, parseCreateComment } from "../src/models/comments";

/** Comentarios por registro con «responder a» (brief de octubre de 2026, punto 33). */

test("parseCreateComment: cuerpo y replyToId", () => {
  assert.deepEqual(parseCreateComment({ entity: "customers", entityId: 3, body: "  Pendiente de cobro  " }), { entity: "customers", entityId: 3, body: "Pendiente de cobro", replyToId: null });
  assert.deepEqual(parseCreateComment({ entity: "products", entityId: 1, body: "Ok", replyToId: 8 }), { entity: "products", entityId: 1, body: "Ok", replyToId: 8 });
});

test("parseCreateComment: rechaza entidad desconocida, cuerpo vacío o de más de 1000 caracteres", () => {
  const bad = (body: unknown, path: string) =>
    assert.throws(() => parseCreateComment(body), (err: unknown) => isDomainError(err) && err.code === "400" && JSON.stringify(err.details).includes(`"${path}"`));
  bad({ entity: "users", entityId: 1, body: "x" }, "entity");
  bad({ entity: "sales", entityId: 1, body: "   " }, "body");
  bad({ entity: "sales", entityId: 1, body: "x".repeat(1001) }, "body");
  bad({ entity: "sales", entityId: 0, body: "x" }, "entityId");
  bad({ entity: "sales", entityId: 1, body: "x", replyToId: -1 }, "replyToId");
});

test("parseCommentsQuery: entity y entityId obligatorios", () => {
  assert.deepEqual(parseCommentsQuery({ entity: "batches", entityId: "12" }), { entity: "batches", entityId: 12 });
  assert.throws(() => parseCommentsQuery({ entity: "batches" }), (err: unknown) => isDomainError(err) && err.code === "400");
  assert.throws(() => parseCommentsQuery({ entity: "nope", entityId: "1" }), (err: unknown) => isDomainError(err) && err.code === "400");
});

test("canSeeEntity: misma matriz que ver el registro", () => {
  assert.equal(canSeeEntity("WAREHOUSE", "products"), true);
  assert.equal(canSeeEntity("WAREHOUSE", "batches"), true);
  assert.equal(canSeeEntity("WAREHOUSE", "customers"), false);
  assert.equal(canSeeEntity("WAREHOUSE", "sales"), false);
  assert.equal(canSeeEntity("WAREHOUSE", "suppliers"), true);
  assert.equal(canSeeEntity("SALES", "customers"), true);
  assert.equal(canSeeEntity("SALES", "sales"), true);
  assert.equal(canSeeEntity("SALES", "suppliers"), false);
  assert.equal(canSeeEntity("ADMIN", "suppliers"), true);
});

test("canDeleteComment: el autor o ADMIN", () => {
  assert.equal(canDeleteComment("SALES", 5, { userId: 5 }), true);
  assert.equal(canDeleteComment("SALES", 5, { userId: 6 }), false);
  assert.equal(canDeleteComment("ADMIN", 1, { userId: 6 }), true);
});
