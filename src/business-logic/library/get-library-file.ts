import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import type { Role } from "../../security/roles";
import { canSeeLibraryItem } from "./shared";

export type LibraryFile = { name: string; mime: string; data: Buffer; updatedAt: Date };

/** El archivo de un documento, solo si el rol puede verlo. 690 en cualquier otro caso (no se revela que exista). */
export const getLibraryFile = async (role: Role, id: number): Promise<LibraryFile> => {
  const { rows } = await db.query<{ name: string | null; mime: string | null; data: Buffer | null; roles: string[]; updatedAt: Date }>(
    `SELECT name, mime, data, roles, updated_at AS "updatedAt" FROM library_items WHERE id = $1 AND kind = 'document'`,
    [id],
  );
  const row = rows[0];
  if (row === undefined || row.name === null || row.mime === null || row.data === null || !canSeeLibraryItem(role, row.roles)) throw domainError(ErrorCodes.LIBRARY_ITEM_NOT_FOUND);
  return { name: row.name, mime: row.mime, data: row.data, updatedAt: row.updatedAt };
};
