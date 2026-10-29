import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";

/** Solo ADMIN. Borrado físico (el archivo se va con el registro); 690 si no existe. */
export const deleteLibraryItem = async (id: number): Promise<void> => {
  const { rowCount } = await db.query(`DELETE FROM library_items WHERE id = $1`, [id]);
  if ((rowCount ?? 0) === 0) throw domainError(ErrorCodes.LIBRARY_ITEM_NOT_FOUND);
};
