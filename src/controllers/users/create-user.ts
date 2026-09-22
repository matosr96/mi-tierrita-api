import type { RequestHandler } from "express";
import { parseCreateUser } from "../../models/index";
import { createUser } from "../../business-logic/users/index";

/** POST /api/v1/users — ADMIN (CU-03). */
export const createUserController: RequestHandler = async (req, res) => {
  res.status(201).json(await createUser(parseCreateUser(req.body)));
};
