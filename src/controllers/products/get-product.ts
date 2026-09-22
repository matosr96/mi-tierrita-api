import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getProduct } from "../../business-logic/products/index";

/** GET /api/v1/products/:id — autenticado. */
export const getProductController: RequestHandler = async (req, res) => {
  res.json(await getProduct(parseId(req.params["id"])));
};
