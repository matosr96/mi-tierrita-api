import { searchTerm, unaccentSql } from "../../common/index";
import { db } from "../../data-sources/index";
import { SEARCH_PER_GROUP, groupsFor, type SearchCustomer, type SearchPerson, type SearchProduct, type SearchResponse, type SearchSupplier } from "../../models/index";
import type { Role } from "../../security/index";

/**
 * Busca en paralelo en cada grupo que el rol puede ver, sin tildes ni mayúsculas (misma comparación que los
 * listados). Solo registros activos: lo que la persona puede abrir y usar hoy.
 */
export const globalSearch = async (role: Role, q: string): Promise<SearchResponse> => {
  const term = searchTerm(q);
  const params = [term, SEARCH_PER_GROUP];
  const groups = groupsFor(role);
  const out: SearchResponse = {};
  await Promise.all(
    groups.map(async (group) => {
      if (group === "products") {
        const { rows } = await db.query<SearchProduct>(
          `SELECT p.id, p.name, p.sku, p.sale_price AS "salePrice",
                  (SELECT COALESCE(sum(b.quantity_remaining), 0)::int FROM product_batches b
                    WHERE b.product_id = p.id AND b.quantity_remaining > 0 AND b.expires_at >= CURRENT_DATE) AS "availableStock"
           FROM products p WHERE p.active AND (${unaccentSql("p.name")} LIKE $1 OR lower(p.sku) LIKE $1)
           ORDER BY p.name LIMIT $2`,
          params,
        );
        out.products = rows;
      } else if (group === "customers") {
        const { rows } = await db.query<SearchCustomer>(
          `SELECT id, name, document_id AS "documentId", balance FROM customers
           WHERE active AND (${unaccentSql("name")} LIKE $1 OR lower(document_id) LIKE $1) ORDER BY name LIMIT $2`,
          params,
        );
        out.customers = rows;
      } else if (group === "people") {
        const { rows } = await db.query<SearchPerson>(
          `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.username, r.name AS role
           FROM users u JOIN roles r ON r.id = u.role_id
           WHERE u.active AND (${unaccentSql("u.first_name || ' ' || u.last_name")} LIKE $1 OR lower(u.username) LIKE $1)
           ORDER BY u.first_name, u.last_name LIMIT $2`,
          params,
        );
        out.people = rows;
      } else {
        const { rows } = await db.query<SearchSupplier>(`SELECT id, name FROM suppliers WHERE active AND ${unaccentSql("name")} LIKE $1 ORDER BY name LIMIT $2`, params);
        out.suppliers = rows;
      }
    }),
  );
  return out;
};
