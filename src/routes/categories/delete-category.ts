import { Router } from "express";
import { parseId } from "../../common/index.js";
import { authorize, Roles } from "../../security/index.js";
import { deleteCategory } from "../../business-logic/categories/index.js";

export const deleteCategoryRoute = Router();

/** DELETE /api/v1/categories/:id — ADMIN. */
deleteCategoryRoute.delete("/:id", authorize(Roles.ADMIN), async (req, res) => {
  await deleteCategory(parseId(req.params["id"]));
  res.status(204).send();
});
