import { Router } from "express";
import { parsePageRequest } from "../../common/index.js";
import { listCategories } from "../../business-logic/categories/index.js";

export const listCategoriesRoute = Router();

/** GET /api/v1/categories — autenticado. Filtro opcional ?active=true|false. */
listCategoriesRoute.get("/", async (req, res) => {
  const active = req.query["active"];
  const filter = active === "true" ? { active: true } : active === "false" ? { active: false } : {};
  res.json(await listCategories(parsePageRequest(req.query), filter));
});
