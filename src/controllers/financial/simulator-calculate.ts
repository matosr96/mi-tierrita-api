import type { RequestHandler } from "express";
import { parseSimulatorCalculate } from "../../models/index";
import { simulate } from "../../business-logic/financial/index";

/** POST /api/v1/financial/simulator/calculate — ADMIN. Recalcula sin guardar (la pantalla lo llama al editar). */
export const simulatorCalculateController: RequestHandler = (req, res) => {
  const input = parseSimulatorCalculate(req.body);
  res.json({ input, result: simulate(input) });
};
