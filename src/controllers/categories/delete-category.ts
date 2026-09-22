import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { deleteCategory } from "../../business-logic/categories/index";

/** DELETE /api/v1/categories/:id — ADMIN. */
export const deleteCategoryController: RequestHandler = async (req, res) => {
  await deleteCategory(parseId(req.params["id"]));
  res.status(204).send();
};
