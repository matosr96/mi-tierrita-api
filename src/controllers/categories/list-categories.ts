import type { RequestHandler } from "express";
import { parsePageRequest, queryBoolean } from "../../common/index";
import { listCategories } from "../../business-logic/categories/index";

/** GET /api/v1/categories — autenticado. Filtro opcional ?active=true|false. */
export const listCategoriesController: RequestHandler = async (req, res) => {
  res.json(await listCategories(parsePageRequest(req.query), { active: queryBoolean(req.query["active"]) }));
};
