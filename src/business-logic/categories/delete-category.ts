import { ErrorCodes, domainError } from "../../common/index";
import { db, isForeignKeyViolation } from "../../data-sources/index";

/** Solo ADMIN. Borrado físico; una categoría con productos asociados no se borra: responde 631. */
export const deleteCategory = async (id: number): Promise<void> => {
  try {
    const { rowCount } = await db.query(`DELETE FROM categories WHERE id = $1`, [id]);
    if ((rowCount ?? 0) === 0) throw domainError(ErrorCodes.CATEGORY_NOT_FOUND);
  } catch (err) {
    if (isForeignKeyViolation(err)) throw domainError(ErrorCodes.CATEGORY_IN_USE);
    throw err;
  }
};
