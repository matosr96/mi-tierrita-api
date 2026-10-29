import "./setup-env";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isOnline, toDirectoryEntry, visibleInDirectory, type DirectoryRow } from "../src/business-logic/users/directory";

const now = new Date("2026-10-29T15:00:00.000Z");
const row = (over: Partial<DirectoryRow> = {}): DirectoryRow => ({
  id: 5,
  firstName: "Karina",
  lastName: "Mestra",
  username: "karina",
  role: "SALES",
  email: "karina@mitierrita.co",
  phone: "300 123 4567",
  hasAvatar: true,
  avatarUpdatedAt: new Date("2026-10-20T12:00:00.000Z"),
  lastSeenAt: new Date(now.getTime() - 30_000),
  lastSignoutAt: null,
  active: true,
  ...over,
});

test("isOnline: misma regla del chat (90 s sin cerrar sesión después)", () => {
  assert.equal(isOnline(new Date(now.getTime() - 30_000), null, now), true);
  assert.equal(isOnline(new Date(now.getTime() - 120_000), null, now), false);
  assert.equal(isOnline(null, null, now), false);
  // Cerró sesión después de la última petición: desconectada aunque esté dentro de la ventana.
  assert.equal(isOnline(new Date(now.getTime() - 30_000), new Date(now.getTime() - 10_000), now), false);
  // Cerró sesión y volvió a entrar: en línea.
  assert.equal(isOnline(new Date(now.getTime() - 10_000), new Date(now.getTime() - 30_000), now), true);
});

test("toDirectoryEntry: todo rol ve rol, contacto y presencia", () => {
  for (const viewer of ["ADMIN", "SALES", "WAREHOUSE"] as const) {
    const e = toDirectoryEntry(viewer, row(), now);
    assert.ok(e);
    assert.equal(e.role, "SALES");
    assert.equal(e.email, "karina@mitierrita.co");
    assert.equal(e.phone, "300 123 4567");
    assert.equal(e.online, true);
    assert.equal(e.hasAvatar, true);
    assert.equal(e.avatarUpdatedAt, "2026-10-20T12:00:00.000Z");
    assert.equal(e.active, true);
    assert.ok(!("passwordHash" in e) && !("tokenVersion" in e));
  }
});

test("toDirectoryEntry: las cuentas inactivas solo las ve el administrador, marcadas y nunca en línea", () => {
  const inactive = row({ active: false });
  assert.equal(visibleInDirectory("SALES", inactive), false);
  assert.equal(visibleInDirectory("WAREHOUSE", inactive), false);
  assert.equal(visibleInDirectory("ADMIN", inactive), true);
  assert.equal(toDirectoryEntry("SALES", inactive, now), null);
  const e = toDirectoryEntry("ADMIN", inactive, now);
  assert.ok(e);
  assert.equal(e.active, false);
  assert.equal(e.online, false);
  assert.equal(e.lastSeenAt, inactive.lastSeenAt?.toISOString());
});
