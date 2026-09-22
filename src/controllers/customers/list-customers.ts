import type { RequestHandler } from "express";
import { parsePageRequest, queryBoolean, queryString } from "../../common/index";
import { listCustomers } from "../../business-logic/customers/index";

/** GET /api/v1/customers — ADMIN, SALES. Filtros: ?active=, ?search=, ?withBalance=true. */
export const listCustomersController: RequestHandler = async (req, res) => {
  res.json(
    await listCustomers(parsePageRequest(req.query), {
      active: queryBoolean(req.query["active"]),
      search: queryString(req.query["search"]),
      withBalance: queryBoolean(req.query["withBalance"]),
    }),
  );
};
