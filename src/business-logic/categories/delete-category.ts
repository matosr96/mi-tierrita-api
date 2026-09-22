import { ErrorCodes, domainError } from "../../common/index.js";
import { categoriesDataSource, isForeignKeyViolation } from "../../data-sources/index.js";

/** Solo ADMIN. Una categoría con productos asociados no se borra: responde 631. */
export const deleteCategory = async (id: number): Promise<void> => {
  try {
    const removed = await categoriesDataSource.remove(id);
    if (!removed) throw domainError(ErrorCodes.CATEGORY_NOT_FOUND);
  } catch (err) {
    if (isForeignKeyViolation(err)) throw domainError(ErrorCodes.CATEGORY_IN_USE);
    throw err;
  }
};
