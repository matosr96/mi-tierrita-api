/** Roles del sistema (RF-01.3). El nombre coincide con la tabla roles. */
export const Roles = {
  ADMIN: "ADMIN",
  SALES: "SALES",
  WAREHOUSE: "WAREHOUSE",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ALL_ROLES: readonly Role[] = [Roles.ADMIN, Roles.SALES, Roles.WAREHOUSE];

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
