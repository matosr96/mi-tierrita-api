import { Router } from "express";
import { validate } from "../../common/index.js";
import { authorize, Roles } from "../../security/index.js";
import { createUserSchema } from "../../models/index.js";
import { createUser } from "../../business-logic/users/index.js";

export const createUserRoute = Router();

/** POST /api/v1/users — ADMIN (CU-03). */
createUserRoute.post("/", authorize(Roles.ADMIN), async (req, res) => {
  const input = validate(createUserSchema, req.body);
  res.status(201).json(await createUser(input));
});
