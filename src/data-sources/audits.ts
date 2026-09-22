import { db, type Queryable } from "./db.js";
import type { NewAudit } from "../models/index.js";

/** Tabla de solo inserción: un registro de auditoría no se edita una vez creado. */
export const auditsDataSource = {
  insert: async (audit: NewAudit, q: Queryable = db): Promise<void> => {
    await q.query(`INSERT INTO audits (user_id, method, resource) VALUES ($1, $2, $3)`, [
      audit.userId,
      audit.method,
      audit.resource,
    ]);
  },
};
