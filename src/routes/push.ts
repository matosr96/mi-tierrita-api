import { Router } from "express";
import { authorize, ALL_ROLES } from "../security/index";
import { deletePushSubscriptionController, pushPublicKeyController, savePushSubscriptionController } from "../controllers/push/index";

/** Web Push: cualquier rol registra sus dispositivos. */
export const pushRouter = Router();
pushRouter.use(authorize(...ALL_ROLES));
pushRouter.get("/public-key", pushPublicKeyController);
pushRouter.post("/subscriptions", savePushSubscriptionController);
pushRouter.delete("/subscriptions", deletePushSubscriptionController);
