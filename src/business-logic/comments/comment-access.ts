import type { CommentEntity } from "../../models/index";
import { Roles, type Role } from "../../security/index";

/**
 * Quién puede comentar y leer comentarios de cada tipo de registro: la misma matriz que ver el registro
 * (documento 06): productos y lotes todos; clientes y ventas ADMIN y SALES; proveedores ADMIN y WAREHOUSE.
 */
export const canSeeEntity = (role: Role, entity: CommentEntity): boolean => {
  switch (entity) {
    case "customers":
    case "sales":
      return role === Roles.ADMIN || role === Roles.SALES;
    case "suppliers":
      return role === Roles.ADMIN || role === Roles.WAREHOUSE;
    default:
      return true;
  }
};

/** Un comentario lo elimina su autor o la administración. */
export const canDeleteComment = (role: Role, userId: number, comment: { userId: number }): boolean => role === Roles.ADMIN || comment.userId === userId;
