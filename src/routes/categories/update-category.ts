import { Router } from "express";
import { parseId, validate } from "../../common/index.js";
import { authorize, Roles } from "../../security/index.js";
import { updateCategorySchema } from "../../models/index.js";
import { updateCategory } from "../../business-logic/categories/index.js";

export const updateCategoryRoute = Router();

/** PUT /api/v1/categories/:id — ADMIN, WAREHOUSE. */
updateCategoryRoute.put("/:id", authorize(Roles.ADMIN, Roles.WAREHOUSE), async (req, res) => {
  const input = validate(updateCategorySchema, req.body);
  res.json(await updateCategory(parseId(req.params["id"]), input));
});
