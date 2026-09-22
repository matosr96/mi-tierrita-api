/**
 * Contrato uniforme de listados (RNF-05): todo GET de listado acepta ?page= (base 1)
 * y ?limit= (por defecto 10) y responde { count, page, pages, items }.
 */
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export type PageRequest = {
  page: number;
  limit: number;
  offset: number;
};

export type PageResponse<T> = {
  count: number;
  page: number;
  pages: number;
  items: T[];
};

const toPositiveInt = (raw: unknown, fallback: number): number => {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Lee page y limit de la query string aplicando valores por defecto y tope. */
export const parsePageRequest = (query: Record<string, unknown>): PageRequest => {
  const page = toPositiveInt(query["page"], 1);
  const limit = Math.min(toPositiveInt(query["limit"], DEFAULT_LIMIT), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
};

export const toPageResponse = <T>(
  request: PageRequest,
  count: number,
  items: T[],
): PageResponse<T> => ({
  count,
  page: request.page,
  pages: count === 0 ? 0 : Math.ceil(count / request.limit),
  items,
});
