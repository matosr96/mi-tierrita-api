import { Router } from "express";
import { validate } from "../../common/index.js";
import { authorize, Roles } from "../../security/index.js";
import { createCategorySchema } from "../../models/index.js";
import { createCategory } from "../../business-logic/categories/index.js";

export const createCategoryRoute = Router();

/** POST /api/v1/categories — ADMIN, WAREHOUSE. */
createCategoryRoute.post("/", authorize(Roles.ADMIN, Roles.WAREHOUSE), async (req, res) => {
  const input = validate(createCategorySchema, req.body);
  res.status(201).json(await createCategory(input));
});
