import type { RequestHandler } from "express";
import { parseCreateSupplier } from "../../models/index";
import { createSupplier } from "../../business-logic/suppliers/index";

/** POST /api/v1/suppliers — ADMIN, WAREHOUSE. */
export const createSupplierController: RequestHandler = async (req, res) => {
  res.status(201).json(await createSupplier(parseCreateSupplier(req.body)));
};
