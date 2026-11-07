import type { RequestHandler } from "express";
import { listPublicCategories } from "../../business-logic/categories/index";

/** GET /api/v1/categories/public — público (página pública): líneas activas con código. */
export const listPublicCategoriesController: RequestHandler = async (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(await listPublicCategories());
};
