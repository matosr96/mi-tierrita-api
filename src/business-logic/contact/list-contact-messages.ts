import { toPageResponse, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toContactMessageResponse, type ContactMessageResponse, type ContactMessageRow, type ContactStatus } from "../../models/index";

export const CONTACT_COLUMNS = `id, name, phone, email, topic, body, status, created_at AS "createdAt"`;

/** Bandeja de contactos del sitio, los más recientes primero. Sin filtro muestra los nuevos y los leídos (no los archivados). */
export const listContactMessages = async (page: PageRequest, filter: { status?: ContactStatus | undefined }): Promise<PageResponse<ContactMessageResponse>> => {
  const where = filter.status === undefined ? "WHERE status <> 'ARCHIVED'" : "WHERE status = $1";
  const filterParams: unknown[] = filter.status === undefined ? [] : [filter.status];
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count FROM contact_messages ${where}`, filterParams),
    db.query<ContactMessageRow>(
      `SELECT ${CONTACT_COLUMNS} FROM contact_messages ${where} ORDER BY created_at DESC, id DESC LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, page.limit, page.offset],
    ),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toContactMessageResponse));
};
