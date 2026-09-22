import { Router } from "express";
import { parseId } from "../../common/index.js";
import { authorize, Roles } from "../../security/index.js";
import { getUser } from "../../business-logic/users/index.js";

export const getUserRoute = Router();

/** GET /api/v1/users/:id — ADMIN. */
getUserRoute.get("/:id", authorize(Roles.ADMIN), async (req, res) => {
  res.json(await getUser(parseId(req.params["id"])));
});
