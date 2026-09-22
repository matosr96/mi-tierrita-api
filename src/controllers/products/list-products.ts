import type { RequestHandler } from "express";
import { parsePageRequest, queryBoolean, queryId, queryString } from "../../common/index";
import { listProducts } from "../../business-logic/products/index";

/** GET /api/v1/products — autenticado. Filtros: ?category=, ?active=, ?search=. */
export const listProductsController: RequestHandler = async (req, res) => {
  res.json(
    await listProducts(parsePageRequest(req.query), {
      categoryId: queryId(req.query["category"]),
      active: queryBoolean(req.query["active"]),
      search: queryString(req.query["search"]),
    }),
  );
};
