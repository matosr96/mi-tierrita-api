import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toLibraryItemResponse, type LibraryItemResponse, type UpdateLibraryItemRequest } from "../../models/index";
import { findLibraryItemById } from "./find-library-item";

/** Solo ADMIN: título, descripción, roles y, en enlaces, la dirección. 690 si no existe; 400 si se manda url a un documento. */
export const updateLibraryItem = async (id: number, input: UpdateLibraryItemRequest): Promise<LibraryItemResponse> => {
  const current = await findLibraryItemById(id);
  if (current === undefined) throw domainError(ErrorCodes.LIBRARY_ITEM_NOT_FOUND);
  if (input.url !== undefined && current.kind !== "link") throw domainError(ErrorCodes.VALIDATION, [{ path: "url", message: "Un documento no tiene dirección; suba otro archivo" }]);
  const sets: string[] = [];
  const params: unknown[] = [id];
  const put = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (input.title !== undefined) put("title", input.title);
  if (input.description !== undefined) put("description", input.description);
  if (input.url !== undefined) put("url", input.url);
  if (input.roles !== undefined) put("roles", input.roles);
  if (sets.length > 0) await db.query(`UPDATE library_items SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, params);
  const updated = await findLibraryItemById(id);
  if (updated === undefined) throw domainError(ErrorCodes.LIBRARY_ITEM_NOT_FOUND);
  return toLibraryItemResponse(updated);
};
