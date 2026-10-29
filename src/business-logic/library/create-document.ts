import { db } from "../../data-sources/index";
import { toLibraryItemResponse, type LibraryItemResponse, type LibraryUploadRequest } from "../../models/index";
import { findLibraryItemById } from "./find-library-item";

/** Solo ADMIN: guarda un documento (el archivo va en la base, como los adjuntos del chat). */
export const createDocument = async (userId: number, input: LibraryUploadRequest): Promise<LibraryItemResponse> => {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO library_items (kind, title, description, name, mime, size, data, roles, created_by)
     VALUES ('document', $1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [input.title, input.description, input.name, input.mime, input.data.length, input.data, input.roles, userId],
  );
  const created = await findLibraryItemById(rows[0]!.id);
  if (created === undefined) throw new Error("Documento recién creado no encontrado");
  return toLibraryItemResponse(created);
};
