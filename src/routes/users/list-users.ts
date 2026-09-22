import { Router } from "express";
import { parsePageRequest } from "../../common/index.js";
import { authorize, Roles } from "../../security/index.js";
import { listUsers } from "../../business-logic/users/index.js";

export const listUsersRoute = Router();

/** GET /api/v1/users — ADMIN. */
listUsersRoute.get("/", authorize(Roles.ADMIN), async (req, res) => {
  res.json(await listUsers(parsePageRequest(req.query)));
});
