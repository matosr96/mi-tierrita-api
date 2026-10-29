import { createValidator } from "../common/validate";
import { ErrorCodes, domainError } from "../common/errors";
import type { Role } from "../security/roles";

/** Comentarios por registro con «responder a» (brief de octubre de 2026, punto 33). */
export const COMMENT_ENTITIES = ["products", "customers", "sales", "suppliers", "batches"] as const;
export type CommentEntity = (typeof COMMENT_ENTITIES)[number];
export const COMMENT_BODY_MAX = 1000;
const EXCERPT_MAX = 120;

export type CommentAuthor = { id: number; firstName: string; lastName: string; username: string; role: Role };

export type CommentRow = {
  id: number;
  entity: CommentEntity;
  entityId: number;
  userId: number;
  firstName: string;
  lastName: string;
  username: string;
  role: Role;
  body: string;
  replyToId: number | null;
  replyUserId: number | null;
  replyFirstName: string | null;
  replyLastName: string | null;
  replyUsername: string | null;
  replyRole: Role | null;
  replyBody: string | null;
  replyDeleted: boolean | null;
  createdAt: Date;
  deletedAt: Date | null;
  tita: boolean;
  titaProposals: unknown[] | null;
  titaActions: Record<string, { status: string; note?: string }> | null;
};

export type CommentResponse = {
  id: number;
  entity: CommentEntity;
  entityId: number;
  body: string;
  author: CommentAuthor;
  /** Comentario al que responde: autor y un extracto (vacío si ese comentario se eliminó). */
  replyTo: { id: number; author: CommentAuthor; excerpt: string; deleted: boolean } | null;
  createdAt: string;
  /** Respuesta de Tita a una mención (@Tita) a nombre del autor, con sus tarjetas y cómo quedaron. */
  tita: boolean;
  titaProposals: unknown[] | null;
  titaActions: Record<string, { status: string; note?: string }> | null;
};

const excerpt = (body: string): string => (body.length > EXCERPT_MAX ? `${body.slice(0, EXCERPT_MAX - 1)}…` : body);

export const toCommentResponse = (row: CommentRow): CommentResponse => ({
  id: row.id,
  entity: row.entity,
  entityId: row.entityId,
  body: row.body,
  author: { id: row.userId, firstName: row.firstName, lastName: row.lastName, username: row.username, role: row.role },
  replyTo:
    row.replyToId === null
      ? null
      : {
          id: row.replyToId,
          author: { id: row.replyUserId!, firstName: row.replyFirstName ?? "", lastName: row.replyLastName ?? "", username: row.replyUsername ?? "", role: row.replyRole ?? "SALES" },
          excerpt: row.replyDeleted ? "" : excerpt(row.replyBody ?? ""),
          deleted: row.replyDeleted === true,
        },
  createdAt: row.createdAt.toISOString(),
  tita: row.tita,
  titaProposals: row.tita ? (row.titaProposals ?? []) : null,
  titaActions: row.tita ? (row.titaActions ?? {}) : null,
});

export type CreateCommentRequest = { entity: CommentEntity; entityId: number; body: string; replyToId: number | null };

export const parseCreateComment = (body: unknown): CreateCommentRequest => {
  const v = createValidator(body);
  const entity = v.oneOf("entity", COMMENT_ENTITIES);
  const entityId = v.number("entityId", { integer: true, min: 1 });
  const text = v.string("body", { min: 1, max: COMMENT_BODY_MAX });
  const replyToId = v.number("replyToId", { integer: true, min: 1 }, false);
  v.done();
  return { entity: entity!, entityId: entityId!, body: text!, replyToId: replyToId ?? null };
};

export type CommentsQuery = { entity: CommentEntity; entityId: number };

/** `?entity=&entityId=` de `GET /comments`. */
export const parseCommentsQuery = (query: Record<string, unknown>): CommentsQuery => {
  const issues: { path: string; message: string }[] = [];
  const entity = query["entity"];
  if (typeof entity !== "string" || !(COMMENT_ENTITIES as readonly string[]).includes(entity)) issues.push({ path: "entity", message: `Debe ser uno de: ${COMMENT_ENTITIES.join(", ")}` });
  const entityId = Number(query["entityId"]);
  if (typeof query["entityId"] !== "string" || !Number.isInteger(entityId) || entityId <= 0) issues.push({ path: "entityId", message: "Debe ser un entero positivo" });
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  return { entity: entity as CommentEntity, entityId };
};
