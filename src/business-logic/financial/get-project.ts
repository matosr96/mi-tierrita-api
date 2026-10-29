import { toProjectDetail, type ProjectDetailResponse } from "../../models/index";
import { requireProject } from "./find-project";

/** Abre un proyecto: supuestos guardados y todas las secciones recalculadas por el motor. */
export const getProject = async (id: number): Promise<ProjectDetailResponse> => toProjectDetail(await requireProject(id));
