import { db, type Queryable } from "../../data-sources/index";
import type { LibraryItemRow } from "../../models/index";
import { LIBRARY_COLUMNS, LIBRARY_FROM } from "./shared";

export const findLibraryItemById = async (id: number, q: Queryable = db): Promise<LibraryItemRow | undefined> => {
  const { rows } = await q.query<LibraryItemRow>(`SELECT ${LIBRARY_COLUMNS} ${LIBRARY_FROM} WHERE l.id = $1`, [id]);
  return rows[0];
};
