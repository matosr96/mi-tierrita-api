import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { getSaleController, listSalesController, registerSaleController, voidSaleController } from "../controllers/sales/index";

export const salesRouter = Router();
salesRouter.post("/", authorize(Roles.ADMIN, Roles.SALES), registerSaleController);
salesRouter.get("/", authorize(Roles.ADMIN, Roles.SALES), listSalesController);
salesRouter.get("/:id", authorize(Roles.ADMIN, Roles.SALES), getSaleController);
salesRouter.post("/:id/void", authorize(Roles.ADMIN), voidSaleController);
