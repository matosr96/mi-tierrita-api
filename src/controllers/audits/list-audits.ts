import type { RequestHandler } from "express";
import { isIsoDate, parsePageRequest, queryId, queryString } from "../../common/index";
import { listAudits } from "../../business-logic/audits/index";

/** GET /api/v1/audits — ADMIN (CU-18). Filtros: ?userId=, ?resource=, ?from=, ?to=. */
export const listAuditsController: RequestHandler = async (req, res) => {
  res.json(
    await listAudits(parsePageRequest(req.query), {
      userId: queryId(req.query["userId"]),
      resource: queryString(req.query["resource"], 200),
      from: isIsoDate(req.query["from"]) ? req.query["from"] : undefined,
      to: isIsoDate(req.query["to"]) ? req.query["to"] : undefined,
    }),
  );
};
