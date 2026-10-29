import { Router } from "express";
import { ALL_ROLES, authorize } from "../security/index";
import { ORDER_KIND_ROLES } from "../business-logic/orders/order-access";
import {
  cancelOrderController,
  createOrderController,
  deliverOrderController,
  getOrderController,
  listOrdersController,
  receiveOrderController,
  updateOrderController,
} from "../controllers/orders/index";

/**
 * Pedidos (no estaban en el documento 06; ver README). Los tres roles entran, pero cada uno solo maneja sus tipos
 * (`ORDER_KIND_ROLES`: SUPPLIER para ADMIN y bodega, CUSTOMER para ADMIN y secretaria); la regla por tipo la aplica la
 * lógica con 613. Recibir y entregar se restringen aquí además por rol.
 */
export const ordersRouter = Router();
ordersRouter.get("/", authorize(...ALL_ROLES), listOrdersController);
ordersRouter.post("/", authorize(...ALL_ROLES), createOrderController);
ordersRouter.get("/:id", authorize(...ALL_ROLES), getOrderController);
ordersRouter.put("/:id", authorize(...ALL_ROLES), updateOrderController);
ordersRouter.post("/:id/receive", authorize(...ORDER_KIND_ROLES.SUPPLIER), receiveOrderController);
ordersRouter.post("/:id/deliver", authorize(...ORDER_KIND_ROLES.CUSTOMER), deliverOrderController);
ordersRouter.post("/:id/cancel", authorize(...ALL_ROLES), cancelOrderController);
