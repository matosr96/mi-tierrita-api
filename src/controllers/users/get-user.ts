import type { RequestHandler } from "express";
import { parseId } from "../../common/index";
import { getUser } from "../../business-logic/users/index";

/** GET /api/v1/users/:id — ADMIN. */
export const getUserController: RequestHandler = async (req, res) => {
  res.json(await getUser(parseId(req.params["id"])));
};
