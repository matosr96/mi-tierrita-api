import { z } from "zod";
import { ALL_ROLES, type Role } from "../security/roles.js";

/** Fila de la tabla users tal como la devuelve la capa de acceso a datos. */
export type UserRow = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  role: Role;
  tokenVersion: number;
  active: boolean;
  createdAt: Date;
};

/** DTO de respuesta: lo que sale por la API. Nunca incluye passwordHash ni tokenVersion. */
export type UserResponse = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  active: boolean;
  createdAt: string;
};

export const toUserResponse = (row: UserRow): UserResponse => ({
  id: row.id,
  firstName: row.firstName,
  lastName: row.lastName,
  username: row.username,
  role: row.role,
  active: row.active,
  createdAt: row.createdAt.toISOString(),
});

const username = z.string().trim().min(3).max(50).regex(/^[a-z0-9._-]+$/i, "Solo letras, números, punto, guion y guion bajo");
const password = z.string().min(8).max(72);

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  username,
  password,
  role: z.enum(ALL_ROLES as [Role, ...Role[]]),
});
export type CreateUserRequest = z.infer<typeof createUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: password,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export const signinSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(72),
});
export type SigninRequest = z.infer<typeof signinSchema>;

export type SigninResponse = {
  token: string;
  user: UserResponse;
};
