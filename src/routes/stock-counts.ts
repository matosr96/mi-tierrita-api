import { Router } from "express";
import { authorize, Roles } from "../security/index";
import {
  applyStockCountController,
  cancelStockCountController,
  createStockCountController,
  getStockCountController,
  listStockCountsController,
  previewAdjustmentController,
  saveStockCountLinesController,
  startStockCountController,
  submitStockCountController,
  updateStockCountController,
} from "../controllers/stock-counts/index";

/** Conteos de inventario: ADMIN y WAREHOUSE programan y registran; solo ADMIN aplica el ajuste. SALES no los ve (613). */
export const stockCountsRouter = Router();
const staff = authorize(Roles.ADMIN, Roles.WAREHOUSE);
stockCountsRouter.get("/", staff, listStockCountsController);
stockCountsRouter.post("/", staff, createStockCountController);
stockCountsRouter.get("/:id", staff, getStockCountController);
stockCountsRouter.put("/:id", staff, updateStockCountController);
stockCountsRouter.post("/:id/start", staff, startStockCountController);
stockCountsRouter.put("/:id/lines", staff, saveStockCountLinesController);
stockCountsRouter.post("/:id/submit", staff, submitStockCountController);
stockCountsRouter.get("/:id/preview-adjustment", staff, previewAdjustmentController);
stockCountsRouter.post("/:id/apply", authorize(Roles.ADMIN), applyStockCountController);
stockCountsRouter.post("/:id/cancel", staff, cancelStockCountController);
