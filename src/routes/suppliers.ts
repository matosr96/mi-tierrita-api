import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { createSupplierController, listSuppliersController, registerPurchaseController, updateSupplierController } from "../controllers/suppliers/index";

export const suppliersRouter = Router();
suppliersRouter.post("/", authorize(Roles.ADMIN, Roles.WAREHOUSE), createSupplierController);
suppliersRouter.get("/", listSuppliersController);
suppliersRouter.put("/:id", authorize(Roles.ADMIN, Roles.WAREHOUSE), updateSupplierController);
suppliersRouter.post("/:id/purchases", authorize(Roles.ADMIN, Roles.WAREHOUSE), registerPurchaseController);
