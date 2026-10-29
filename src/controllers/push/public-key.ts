import type { RequestHandler } from "express";
import { pushPublicKey } from "../../business-logic/push/index";

/** GET /api/v1/push/public-key — cualquier rol. `{ enabled, publicKey }`; sin VAPID, enabled = false. */
export const pushPublicKeyController: RequestHandler = (_req, res) => {
  res.json(pushPublicKey());
};
