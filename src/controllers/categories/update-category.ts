import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdateCategory } from "../../models/index";
import { updateCategory } from "../../business-logic/categories/index";

/** PUT /api/v1/categories/:id — ADMIN, WAREHOUSE. */
export const updateCategoryController: RequestHandler = async (req, res) => {
  res.json(await updateCategory(parseId(req.params["id"]), parseUpdateCategory(req.body)));
};
