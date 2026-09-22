import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdateSupplier } from "../../models/index";
import { updateSupplier } from "../../business-logic/suppliers/index";

/** PUT /api/v1/suppliers/:id — ADMIN, WAREHOUSE. */
export const updateSupplierController: RequestHandler = async (req, res) => {
  res.json(await updateSupplier(parseId(req.params["id"]), parseUpdateSupplier(req.body)));
};
