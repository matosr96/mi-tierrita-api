import { db } from "../../data-sources/index";
import { assertProjectOwner, requireProject } from "./find-project";

/** Elimina un proyecto propio. */
export const deleteProject = async (id: number, userId: number): Promise<void> => {
  assertProjectOwner(await requireProject(id), userId);
  await db.query(`DELETE FROM financial_projects WHERE id = $1`, [id]);
};
