import { Router } from "express";
import { authorize, ALL_ROLES, Roles } from "../security/index";
import {
  createDocumentController,
  createLinkController,
  deleteLibraryItemController,
  getLibraryFileController,
  listLibraryController,
  updateLibraryItemController,
} from "../controllers/library/index";

/** Biblioteca de documentos y enlaces: todos los roles la consultan (filtrada por rol); solo ADMIN la administra. */
export const libraryRouter = Router();
libraryRouter.get("/", authorize(...ALL_ROLES), listLibraryController);
libraryRouter.post("/links", authorize(Roles.ADMIN), createLinkController);
libraryRouter.post("/documents", authorize(Roles.ADMIN), createDocumentController);
libraryRouter.get("/:id/file", authorize(...ALL_ROLES), getLibraryFileController);
libraryRouter.put("/:id", authorize(Roles.ADMIN), updateLibraryItemController);
libraryRouter.delete("/:id", authorize(Roles.ADMIN), deleteLibraryItemController);
