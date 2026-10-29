import { db } from "../../data-sources/index";
import { toLibraryItemResponse, type CreateLinkRequest, type LibraryItemResponse } from "../../models/index";
import { findLibraryItemById } from "./find-library-item";

/** Solo ADMIN: agrega un enlace a la biblioteca. */
export const createLink = async (userId: number, input: CreateLinkRequest): Promise<LibraryItemResponse> => {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO library_items (kind, title, description, url, roles, created_by) VALUES ('link', $1, $2, $3, $4, $5) RETURNING id`,
    [input.title, input.description, input.url, input.roles, userId],
  );
  const created = await findLibraryItemById(rows[0]!.id);
  if (created === undefined) throw new Error("Enlace recién creado no encontrado");
  return toLibraryItemResponse(created);
};
