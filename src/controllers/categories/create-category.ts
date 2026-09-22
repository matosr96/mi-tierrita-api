import type { RequestHandler } from "express";
import { parseCreateCategory } from "../../models/index";
import { createCategory } from "../../business-logic/categories/index";

/** POST /api/v1/categories — ADMIN, WAREHOUSE. */
export const createCategoryController: RequestHandler = async (req, res) => {
  res.status(201).json(await createCategory(parseCreateCategory(req.body)));
};
