import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { createCategoryController, deleteCategoryController, listCategoriesController, updateCategoryController } from "../controllers/categories/index";

export const categoriesRouter = Router();
categoriesRouter.post("/", authorize(Roles.ADMIN, Roles.WAREHOUSE), createCategoryController);
categoriesRouter.get("/", listCategoriesController);
categoriesRouter.put("/:id", authorize(Roles.ADMIN, Roles.WAREHOUSE), updateCategoryController);
categoriesRouter.delete("/:id", authorize(Roles.ADMIN), deleteCategoryController);
