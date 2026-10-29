import { test } from "node:test";
import assert from "node:assert/strict";
import { isDomainError } from "../src/common/errors";
import { parseAvatarUpload, toUserResponse, type UserRow } from "../src/models/users";

const paths400 = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    if (isDomainError(err) && err.code === "400") return (err.details as { path: string }[]).map((d) => d.path);
  }
  return [];
};

test("parseAvatarUpload acepta JPEG, PNG y WebP de hasta 1 MB", () => {
  assert.equal(parseAvatarUpload({ body: Buffer.from([0xff, 0xd8]), contentType: "image/jpeg" }).mime, "image/jpeg");
  assert.equal(parseAvatarUpload({ body: Buffer.alloc(1024 * 1024), contentType: "image/webp; charset=binary" }).mime, "image/webp");
  assert.deepEqual(paths400(() => parseAvatarUpload({ body: Buffer.from("x"), contentType: "image/gif" })), ["file"]);
  assert.deepEqual(paths400(() => parseAvatarUpload({ body: Buffer.from("x"), contentType: "application/pdf" })), ["file"]);
  assert.deepEqual(paths400(() => parseAvatarUpload({ body: Buffer.alloc(1024 * 1024 + 1), contentType: "image/png" })), ["file"]);
  assert.deepEqual(paths400(() => parseAvatarUpload({ body: {}, contentType: "image/png" })), ["file"]);
});

test("toUserResponse expone hasAvatar y avatarUpdatedAt sin la foto ni el hash", () => {
  const row: UserRow = {
    id: 1, firstName: "Ana", lastName: "Pérez", username: "ana", passwordHash: "x", role: "SALES", tokenVersion: 0, active: true, email: null, phone: null,
    createdAt: new Date("2026-01-01T00:00:00Z"), hasAvatar: true, avatarUpdatedAt: new Date("2026-10-29T12:00:00Z"),
  };
  const out = toUserResponse(row);
  assert.equal(out.hasAvatar, true);
  assert.equal(out.avatarUpdatedAt, "2026-10-29T12:00:00.000Z");
  assert.equal("passwordHash" in out, false);
  assert.equal(toUserResponse({ ...row, hasAvatar: false, avatarUpdatedAt: null }).avatarUpdatedAt, null);
});
