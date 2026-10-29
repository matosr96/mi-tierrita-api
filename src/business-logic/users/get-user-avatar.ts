import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";

export type UserAvatar = { mime: string; data: Buffer; updatedAt: Date };

/** Foto de cualquier persona del equipo (todos los roles la ven en la barra, el chat y las tarjetas). 691 si no tiene. */
export const getUserAvatar = async (id: number): Promise<UserAvatar> => {
  const { rows } = await db.query<{ mime: string | null; data: Buffer | null; updatedAt: Date | null }>(
    `SELECT avatar_mime AS mime, avatar AS data, avatar_updated_at AS "updatedAt" FROM users WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  if (row.data === null || row.mime === null || row.updatedAt === null) throw domainError(ErrorCodes.AVATAR_NOT_FOUND);
  return { mime: row.mime, data: row.data, updatedAt: row.updatedAt };
};
