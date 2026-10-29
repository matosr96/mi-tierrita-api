import { db } from "../../data-sources/index";
import { toProjectDetail, type ProjectDetailResponse, type SaveProjectRequest } from "../../models/index";
import { requireProject } from "./find-project";

/** «Guardar como»: crea un proyecto nuevo del usuario con los supuestos recibidos. */
export const saveProject = async (userId: number, request: SaveProjectRequest): Promise<ProjectDetailResponse> => {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO financial_projects (name, user_id, input) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [request.name, userId, JSON.stringify(request.input)],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("INSERT de proyecto no devolvió id");
  return toProjectDetail(await requireProject(id));
};
