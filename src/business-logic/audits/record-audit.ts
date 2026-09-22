import { db } from "../../data-sources/index";
import type { NewAudit } from "../../models/index";

/** Tabla de solo inserción: un registro de auditoría no se edita una vez creado. */
export const recordAudit = async (audit: NewAudit): Promise<void> => {
  await db.query(`INSERT INTO audits (user_id, method, resource) VALUES ($1, $2, $3)`, [
    audit.userId,
    audit.method,
    audit.resource,
  ]);
};
