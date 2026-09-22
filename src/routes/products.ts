import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { createProductController, deactivateProductController, getProductController, listProductsController, updateProductController } from "../controllers/products/index";
import { listProductBatchesController, registerBatchController } from "../controllers/batches/index";

export const productsRouter = Router();
productsRouter.post("/", authorize(Roles.ADMIN, Roles.WAREHOUSE), createProductController);
productsRouter.get("/", listProductsController);
productsRouter.get("/:id", getProductController);
productsRouter.put("/:id", authorize(Roles.ADMIN, Roles.WAREHOUSE), updateProductController);
productsRouter.delete("/:id", authorize(Roles.ADMIN), deactivateProductController);
productsRouter.post("/:id/batches", authorize(Roles.ADMIN, Roles.WAREHOUSE), registerBatchController);
productsRouter.get("/:id/batches", listProductBatchesController);
