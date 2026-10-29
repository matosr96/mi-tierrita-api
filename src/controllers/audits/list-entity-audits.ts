import type { RequestHandler } from "express";
import { parseId, parsePageRequest } from "../../common/index";
import { parseAuditEntity } from "../../models/index";
import { listEntityAudits } from "../../business-logic/audits/index";

/** GET /api/v1/audits/entity/:entity/:id — ADMIN. Línea de tiempo de un registro (brief 33). */
export const listEntityAuditsController: RequestHandler = async (req, res) => {
  res.json(await listEntityAudits(parsePageRequest(req.query), parseAuditEntity(req.params["entity"]), parseId(req.params["id"])));
};
