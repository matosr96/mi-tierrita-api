import type { RequestHandler } from "express";
import { parseCreateProduct } from "../../models/index";
import { createProduct } from "../../business-logic/products/index";

/** POST /api/v1/products — ADMIN, WAREHOUSE (CU-05). */
export const createProductController: RequestHandler = async (req, res) => {
  res.status(201).json(await createProduct(parseCreateProduct(req.body)));
};
