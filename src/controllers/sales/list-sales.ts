import type { RequestHandler } from "express";
import { isIsoDate, parsePageRequest, queryId } from "../../common/index";
import { ALL_SALE_STATUSES, type SaleStatus } from "../../models/index";
import { listSales } from "../../business-logic/sales/index";

/** GET /api/v1/sales — ADMIN, SALES (CU-10). Filtros: ?from=, ?to=, ?customerId=, ?userId=, ?status=. */
export const listSalesController: RequestHandler = async (req, res) => {
  const status = req.query["status"];
  res.json(
    await listSales(parsePageRequest(req.query), {
      from: isIsoDate(req.query["from"]) ? req.query["from"] : undefined,
      to: isIsoDate(req.query["to"]) ? req.query["to"] : undefined,
      customerId: queryId(req.query["customerId"]),
      userId: queryId(req.query["userId"]),
      status: typeof status === "string" && (ALL_SALE_STATUSES as readonly string[]).includes(status) ? (status as SaleStatus) : undefined,
    }),
  );
};
