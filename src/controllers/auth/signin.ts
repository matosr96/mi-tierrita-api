import type { RequestHandler } from "express";
import { parseSignin } from "../../models/index";
import { signin } from "../../business-logic/auth/index";

/** POST /api/v1/auth/signin — público (CU-01). */
export const signinController: RequestHandler = async (req, res) => {
  res.status(200).json(await signin(parseSignin(req.body)));
};
