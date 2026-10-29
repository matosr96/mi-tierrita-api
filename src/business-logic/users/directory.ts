import { db } from "../../data-sources/index";
import type { DirectoryEntry } from "../../models/index";
import type { Role } from "../../security/index";

/**
 * Directorio de personas (brief de octubre de 2026, punto 30: ficha de persona). Cualquier rol ve a sus compañeros
 * con rol, contacto y presencia; solo el administrador ve además las cuentas inactivas (marcadas con `active`).
 * La regla de presencia es la misma del panel «Equipo» del chat (`chat-team.ts`): en línea quien hizo una petición en
 * los últimos 90 segundos y no cerró sesión después.
 */
export const ONLINE_WINDOW_MS = 90_000;

export type DirectoryRow = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  email: string | null;
  phone: string | null;
  hasAvatar: boolean;
  avatarUpdatedAt: Date | null;
  lastSeenAt: Date | null;
  lastSignoutAt: Date | null;
  active: boolean;
};

/** Presencia pura: última petición dentro de la ventana y sin cierre de sesión posterior. */
export const isOnline = (lastSeenAt: Date | null, lastSignoutAt: Date | null, now: Date): boolean =>
  lastSeenAt !== null && now.getTime() - lastSeenAt.getTime() <= ONLINE_WINDOW_MS && (lastSignoutAt === null || lastSignoutAt.getTime() < lastSeenAt.getTime());

/** Quién aparece en el directorio para un rol: todos ven a los activos; el administrador también a los inactivos. */
export const visibleInDirectory = (viewerRole: Role, row: Pick<DirectoryRow, "active">): boolean => row.active || viewerRole === "ADMIN";

/** Ficha pura de una persona para quien mira: `null` si ese rol no debe verla. Todo rol ve rol y contacto. */
export const toDirectoryEntry = (viewerRole: Role, row: DirectoryRow, now: Date): DirectoryEntry | null => {
  if (!visibleInDirectory(viewerRole, row)) return null;
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    username: row.username,
    role: row.role,
    email: row.email,
    phone: row.phone,
    hasAvatar: row.hasAvatar,
    avatarUpdatedAt: row.avatarUpdatedAt === null ? null : row.avatarUpdatedAt.toISOString(),
    online: row.active && isOnline(row.lastSeenAt, row.lastSignoutAt, now),
    lastSeenAt: row.lastSeenAt === null ? null : row.lastSeenAt.toISOString(),
    active: row.active,
  };
};

/** Directorio completo (incluida la persona que pregunta), activos primero y luego por nombre. */
export const listDirectory = async (viewerRole: Role, now: Date = new Date()): Promise<DirectoryEntry[]> => {
  const { rows } = await db.query<DirectoryRow>(
    `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.username, r.name AS role,
            u.email, u.phone, (u.avatar IS NOT NULL) AS "hasAvatar", u.avatar_updated_at AS "avatarUpdatedAt",
            u.last_seen_at AS "lastSeenAt", u.last_signout_at AS "lastSignoutAt", u.active
     FROM users u JOIN roles r ON r.id = u.role_id
     ${viewerRole === "ADMIN" ? "" : "WHERE u.active"}
     ORDER BY u.active DESC, u.first_name, u.last_name, u.id`,
  );
  return rows.map((row) => toDirectoryEntry(viewerRole, row, now)).filter((e): e is DirectoryEntry => e !== null);
};
