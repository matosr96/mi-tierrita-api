import type { Role } from "../../security/roles";

export const LIBRARY_COLUMNS = `
  l.id, l.kind, l.title, l.description, l.url, l.name, l.mime, l.size, l.roles,
  l.created_by AS "createdBy", (u.first_name || ' ' || u.last_name) AS "createdByName",
  l.created_at AS "createdAt", l.updated_at AS "updatedAt"`;

export const LIBRARY_FROM = `FROM library_items l JOIN users u ON u.id = l.created_by`;

/** Un ítem sin roles lo ven todos; con roles, solo quienes tengan uno de ellos. */
export const canSeeLibraryItem = (role: Role, roles: readonly string[]): boolean => roles.length === 0 || roles.includes(role);

/** Condición SQL equivalente a canSeeLibraryItem para el rol en el parámetro `$n`. */
export const visibleSql = (param: string): string => `(cardinality(l.roles) = 0 OR $${param} = ANY (l.roles))`;
