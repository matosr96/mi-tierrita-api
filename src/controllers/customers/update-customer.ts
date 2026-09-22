import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { parseUpdateCustomer } from "../../models/index";
import { updateCustomer } from "../../business-logic/customers/index";

/** PUT /api/v1/customers/:id — ADMIN, SALES. */
export const updateCustomerController: RequestHandler = async (req, res) => {
  res.json(await updateCustomer(parseId(req.params["id"]), parseUpdateCustomer(req.body)));
};
