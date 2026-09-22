import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { deactivateProduct } from "../../business-logic/products/index";

/** DELETE /api/v1/products/:id — ADMIN. Desactiva; el producto conserva su histórico. */
export const deactivateProductController: RequestHandler = async (req, res) => {
  await deactivateProduct(parseId(req.params["id"]));
  res.status(204).send();
};
