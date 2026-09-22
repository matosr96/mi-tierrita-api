import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { listUsers } from "../../business-logic/users/index";

/** GET /api/v1/users — ADMIN. */
export const listUsersController: RequestHandler = async (req, res) => {
  res.json(await listUsers(parsePageRequest(req.query)));
};
