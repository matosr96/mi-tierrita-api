import { db } from "../../data-sources/index";
import { toProjectDetail, type ProjectDetailResponse, type UpdateProjectRequest } from "../../models/index";
import { assertProjectOwner, requireProject } from "./find-project";

/** «Guardar proyecto»: sobrescribe los supuestos (y el nombre, si llega) de un proyecto propio. */
export const updateProject = async (id: number, userId: number, request: UpdateProjectRequest): Promise<ProjectDetailResponse> => {
  return db.transaction(async (client) => {
    const project = await requireProject(id, client);
    assertProjectOwner(project, userId);
    await client.query(
      `UPDATE financial_projects SET name = COALESCE($2, name), input = $3::jsonb, updated_at = now() WHERE id = $1`,
      [id, request.name ?? null, JSON.stringify(request.input)],
    );
    return toProjectDetail(await requireProject(id, client));
  });
};
