import type { RequestHandler } from "express";
import { SIMULATOR_DEFAULTS, simulate } from "../../business-logic/financial/index";

/** GET /api/v1/financial/simulator/defaults — ADMIN. Supuestos del ejemplo del brief y su cálculo. */
export const simulatorDefaultsController: RequestHandler = (_req, res) => {
  res.json({ input: SIMULATOR_DEFAULTS, result: simulate(SIMULATOR_DEFAULTS) });
};
