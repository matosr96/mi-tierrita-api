import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdateProduct } from "../../models/index";
import { updateProduct } from "../../business-logic/products/index";

/** PUT /api/v1/products/:id — ADMIN, WAREHOUSE. */
export const updateProductController: RequestHandler = async (req, res) => {
  res.json(await updateProduct(parseId(req.params["id"]), parseUpdateProduct(req.body)));
};
