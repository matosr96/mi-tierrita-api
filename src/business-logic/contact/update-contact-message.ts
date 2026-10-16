import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toContactMessageResponse, type ContactMessageResponse, type ContactMessageRow, type UpdateContactMessageRequest } from "../../models/index";
import { CONTACT_COLUMNS } from "./list-contact-messages";

/** Marca un contacto como leído, archivado o nuevo otra vez. */
export const updateContactMessage = async (id: number, input: UpdateContactMessageRequest): Promise<ContactMessageResponse> => {
  const { rows } = await db.query<ContactMessageRow>(`UPDATE contact_messages SET status = $2 WHERE id = $1 RETURNING ${CONTACT_COLUMNS}`, [id, input.status]);
  const row = rows[0];
  if (row === undefined) throw domainError(ErrorCodes.CONTACT_MESSAGE_NOT_FOUND);
  return toContactMessageResponse(row);
};
