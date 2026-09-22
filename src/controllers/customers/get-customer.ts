import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getCustomer } from "../../business-logic/customers/index";

/** GET /api/v1/customers/:id — ADMIN, SALES. */
export const getCustomerController: RequestHandler = async (req, res) => {
  res.json(await getCustomer(parseId(req.params["id"])));
};
