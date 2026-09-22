import type { RequestHandler } from "express";
import { parsePageRequest, queryBoolean } from "../../common/index";
import { listSuppliers } from "../../business-logic/suppliers/index";

/** GET /api/v1/suppliers — autenticado. */
export const listSuppliersController: RequestHandler = async (req, res) => {
  res.json(await listSuppliers(parsePageRequest(req.query), { active: queryBoolean(req.query["active"]) }));
};
