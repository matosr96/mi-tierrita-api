import { toScenarioDetail, type ScenarioDetailResponse } from "../../models/index";
import { requireScenario } from "./find-scenario";

export const getScenario = async (id: number): Promise<ScenarioDetailResponse> => toScenarioDetail(await requireScenario(id));
