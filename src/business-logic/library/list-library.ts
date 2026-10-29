import { searchTerm, toPageResponse, unaccentSql, type PageRequest, type PageResponse } from "../../common/index";
import { db } from "../../data-sources/index";
import { toLibraryItemResponse, type LibraryItemResponse, type LibraryItemRow, type LibraryQuery } from "../../models/index";
import type { Role } from "../../security/roles";
import { LIBRARY_COLUMNS, LIBRARY_FROM, visibleSql } from "./shared";

/** Lo más reciente primero; solo lo que el rol puede ver; `q` busca en título, descripción y nombre del archivo sin tildes. */
export const listLibrary = async (role: Role, page: PageRequest, filter: LibraryQuery): Promise<PageResponse<LibraryItemResponse>> => {
  const params: unknown[] = [role];
  const where = [visibleSql("1")];
  if (filter.kind !== undefined) {
    params.push(filter.kind);
    where.push(`l.kind = $${params.length}`);
  }
  if (filter.q !== undefined) {
    params.push(searchTerm(filter.q));
    where.push(`(${unaccentSql("l.title")} LIKE $${params.length} OR ${unaccentSql("l.description")} LIKE $${params.length} OR ${unaccentSql("coalesce(l.name, '')")} LIKE $${params.length})`);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query<{ count: number }>(`SELECT count(*)::int AS count ${LIBRARY_FROM} ${whereSql}`, params),
    db.query<LibraryItemRow>(`SELECT ${LIBRARY_COLUMNS} ${LIBRARY_FROM} ${whereSql} ORDER BY l.created_at DESC, l.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, page.limit, page.offset]),
  ]);
  return toPageResponse(page, countRows[0]?.count ?? 0, rows.map(toLibraryItemResponse));
};
