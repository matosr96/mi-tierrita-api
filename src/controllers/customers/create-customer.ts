import type { RequestHandler } from "express";
import { parseCreateCustomer } from "../../models/index";
import { createCustomer } from "../../business-logic/customers/index";

/** POST /api/v1/customers — ADMIN, SALES. */
export const createCustomerController: RequestHandler = async (req, res) => {
  res.status(201).json(await createCustomer(parseCreateCustomer(req.body)));
};
