import { Router } from "express";
import { authorize, Roles } from "../security/index";
import {
  createCustomerController,
  getCustomerBalanceController,
  getCustomerController,
  listCustomersController,
  registerPaymentController,
  updateCustomerController,
} from "../controllers/customers/index";

export const customersRouter = Router();
customersRouter.use(authorize(Roles.ADMIN, Roles.SALES));
customersRouter.post("/", createCustomerController);
customersRouter.get("/", listCustomersController);
customersRouter.get("/:id", getCustomerController);
customersRouter.put("/:id", updateCustomerController);
customersRouter.get("/:id/balance", getCustomerBalanceController);
customersRouter.post("/:id/payments", registerPaymentController);
