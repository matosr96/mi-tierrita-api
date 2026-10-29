import { db, type Queryable } from "../../data-sources/index";
import type { CommentEntity, CommentRow } from "../../models/index";

export const COMMENT_COLUMNS = `
  c.id, c.entity, c.entity_id AS "entityId", c.user_id AS "userId", u.first_name AS "firstName", u.last_name AS "lastName",
  u.username, r.name AS role, c.body, c.reply_to_id AS "replyToId",
  p.user_id AS "replyUserId", pu.first_name AS "replyFirstName", pu.last_name AS "replyLastName", pu.username AS "replyUsername", pr.name AS "replyRole",
  p.body AS "replyBody", p.deleted_at IS NOT NULL AS "replyDeleted",
  c.created_at AS "createdAt", c.deleted_at AS "deletedAt",
  c.tita, c.tita_proposals AS "titaProposals", c.tita_actions AS "titaActions"`;

export const COMMENT_FROM = `
  FROM record_comments c
  JOIN users u ON u.id = c.user_id
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN record_comments p ON p.id = c.reply_to_id
  LEFT JOIN users pu ON pu.id = p.user_id
  LEFT JOIN roles pr ON pr.id = pu.role_id`;

export const findCommentById = async (id: number, q: Queryable = db): Promise<CommentRow | undefined> => {
  const { rows } = await q.query<CommentRow>(`SELECT ${COMMENT_COLUMNS} ${COMMENT_FROM} WHERE c.id = $1`, [id]);
  return rows[0];
};

/** Tabla de cada tipo de registro comentable (los lotes viven en product_batches). */
const TABLES: Record<CommentEntity, string> = { products: "products", customers: "customers", sales: "sales", suppliers: "suppliers", batches: "product_batches" };

export const recordExists = async (entity: CommentEntity, entityId: number): Promise<boolean> => {
  const { rows } = await db.query(`SELECT 1 FROM ${TABLES[entity]} WHERE id = $1`, [entityId]);
  return rows.length > 0;
};
