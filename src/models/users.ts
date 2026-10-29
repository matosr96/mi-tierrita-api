import { ErrorCodes, domainError } from "../common/errors";
import { createValidator } from "../common/validate";
import { ALL_ROLES, type Role } from "../security/roles";

/** Fila de la tabla users tal como la devuelve la consulta. */
export type UserRow = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  role: Role;
  tokenVersion: number;
  active: boolean;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  hasAvatar: boolean;
  avatarUpdatedAt: Date | null;
};

/** DTO de respuesta: lo que sale por la API. Nunca incluye passwordHash ni tokenVersion. */
export type UserResponse = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  active: boolean;
  email: string | null;
  phone: string | null;
  createdAt: string;
  /** Foto de perfil: la app la pide en GET /users/:id/avatar y usa `avatarUpdatedAt` como clave de caché. */
  hasAvatar: boolean;
  avatarUpdatedAt: string | null;
};

export const toUserResponse = (row: UserRow): UserResponse => ({
  id: row.id,
  firstName: row.firstName,
  lastName: row.lastName,
  username: row.username,
  role: row.role,
  active: row.active,
  email: row.email,
  phone: row.phone,
  createdAt: row.createdAt.toISOString(),
  hasAvatar: row.hasAvatar,
  avatarUpdatedAt: row.avatarUpdatedAt === null ? null : row.avatarUpdatedAt.toISOString(),
});

const USERNAME_RULE = { min: 3, max: 50, pattern: /^[a-z0-9._-]+$/i, patternMessage: "Solo letras, números, punto, guion y guion bajo" };
const PASSWORD_RULE = { min: 8, max: 72, trim: false };

export type CreateUserRequest = { firstName: string; lastName: string; username: string; password: string; role: Role };

export const parseCreateUser = (body: unknown): CreateUserRequest => {
  const v = createValidator(body);
  const firstName = v.string("firstName", { min: 1, max: 80 });
  const lastName = v.string("lastName", { min: 1, max: 80 });
  const username = v.string("username", USERNAME_RULE);
  const password = v.string("password", PASSWORD_RULE);
  const role = v.oneOf("role", ALL_ROLES);
  v.done();
  return { firstName: firstName!, lastName: lastName!, username: username!, password: password!, role: role! };
};

export const EMAIL_RULE = { max: 120, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: "Correo inválido" };
export const PHONE_RULE = { min: 7, max: 30, pattern: /^[0-9+()\s-]+$/, patternMessage: "Solo números, espacios, +, ( ) y guiones" };

/** Mi perfil: nombre y contacto propios. `null` borra el correo o el teléfono; el usuario y el rol no se tocan aquí. */
export type UpdateOwnProfileRequest = { firstName?: string | undefined; lastName?: string | undefined; email?: string | null | undefined; phone?: string | null | undefined };

export const parseUpdateOwnProfile = (body: unknown): UpdateOwnProfileRequest => {
  const v = createValidator(body);
  const firstName = v.string("firstName", { min: 1, max: 80 }, false);
  const lastName = v.string("lastName", { min: 1, max: 80 }, false);
  // Enviar null o "" borra el dato opcional.
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const blank = (field: string) => v.isNull(field) || (typeof data[field] === "string" && (data[field] as string).trim() === "");
  const email = blank("email") ? null : v.string("email", EMAIL_RULE, false);
  const phone = blank("phone") ? null : v.string("phone", PHONE_RULE, false);
  if (!["firstName", "lastName", "email", "phone"].some((f) => v.has(f))) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return { firstName, lastName, email: email === undefined ? undefined : email === null ? null : email.toLowerCase(), phone };
};

export type ChangePasswordRequest = { currentPassword: string; newPassword: string };

export const parseChangePassword = (body: unknown): ChangePasswordRequest => {
  const v = createValidator(body);
  const currentPassword = v.string("currentPassword", { min: 1, max: 72, trim: false });
  const newPassword = v.string("newPassword", PASSWORD_RULE);
  v.done();
  return { currentPassword: currentPassword!, newPassword: newPassword! };
};

export type SigninRequest = { username: string; password: string };

export const parseSignin = (body: unknown): SigninRequest => {
  const v = createValidator(body);
  const username = v.string("username", { min: 1, max: 50 });
  const password = v.string("password", { min: 1, max: 72, trim: false });
  v.done();
  return { username: username!, password: password! };
};

export type SigninResponse = { token: string; user: UserResponse };

/* ---------- foto de perfil ---------- */

export const AVATAR_MAX_BYTES = 1024 * 1024;
export const AVATAR_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

export type AvatarUploadRequest = { mime: string; data: Buffer };

/** La foto llega como cuerpo binario (la app la reduce a 256×256); tipo en Content-Type. */
export const parseAvatarUpload = (input: { body: unknown; contentType: string | undefined }): AvatarUploadRequest => {
  const issues: { path: string; message: string }[] = [];
  const mime = (input.contentType ?? "").split(";")[0]!.trim().toLowerCase();
  if (!AVATAR_TYPES.includes(mime)) issues.push({ path: "file", message: "La foto debe ser JPEG, PNG o WebP" });
  const data = Buffer.isBuffer(input.body) ? input.body : Buffer.alloc(0);
  if (data.length === 0) issues.push({ path: "file", message: "La foto está vacía" });
  if (data.length > AVATAR_MAX_BYTES) issues.push({ path: "file", message: "La foto pesa más de 1 MB" });
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  return { mime, data };
};

/* ---------- directorio de personas (brief 2.5, punto 30) ---------- */

/** Ficha de una persona para cualquier rol: rol, contacto y presencia (misma regla que el chat). `active` solo es false para el administrador. */
export type DirectoryEntry = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  email: string | null;
  phone: string | null;
  hasAvatar: boolean;
  avatarUpdatedAt: string | null;
  online: boolean;
  lastSeenAt: string | null;
  active: boolean;
};
