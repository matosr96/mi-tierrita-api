import { ErrorCodes, domainError } from "../common/errors";
import { Roles, type Role } from "../security/roles";

/** Búsqueda global (brief de octubre de 2026, punto 29): productos, clientes, personas y proveedores desde Ctrl+K. */
export const SEARCH_GROUPS = ["products", "customers", "people", "suppliers"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;
/** Resultados por grupo: la paleta muestra pocos y la persona afina la búsqueda. */
export const SEARCH_PER_GROUP = 6;

export type SearchProduct = { id: number; name: string; sku: string; availableStock: number; salePrice: number };
export type SearchCustomer = { id: number; name: string; documentId: string; balance: number };
/** Personas del equipo: sin correo ni teléfono (eso es de la ficha, no de la búsqueda). */
export type SearchPerson = { id: number; firstName: string; lastName: string; username: string; role: Role };
export type SearchSupplier = { id: number; name: string };

/** Solo vienen los grupos que el rol puede ver (`groupsFor`). */
export type SearchResponse = {
  products?: SearchProduct[];
  customers?: SearchCustomer[];
  people?: SearchPerson[];
  suppliers?: SearchSupplier[];
};

/** `?q=`: texto de al menos dos caracteres (recortado y acotado). */
export const parseSearchQuery = (raw: unknown): string => {
  const q = typeof raw === "string" ? raw.trim().slice(0, SEARCH_MAX) : "";
  if (q.length < SEARCH_MIN) throw domainError(ErrorCodes.VALIDATION, [{ path: "q", message: `Mínimo ${SEARCH_MIN} caracteres` }]);
  return q;
};

/** Misma matriz de roles que los listados (documento 06): clientes ADMIN y SALES; proveedores ADMIN y WAREHOUSE; el resto todos. */
export const groupsFor = (role: Role): SearchGroup[] =>
  SEARCH_GROUPS.filter((g) => {
    if (g === "customers") return role === Roles.ADMIN || role === Roles.SALES;
    if (g === "suppliers") return role === Roles.ADMIN || role === Roles.WAREHOUSE;
    return true;
  });
