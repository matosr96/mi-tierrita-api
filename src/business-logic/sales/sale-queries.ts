import type { Queryable } from "../../data-sources/index";
import type { SaleLineRow, SaleRow } from "../../models/index";

export const SALE_COLUMNS = `
  s.id, s.invoice_number AS "invoiceNumber", s.customer_id AS "customerId", c.name AS "customerName",
  s.user_id AS "userId", u.username, s.payment_type AS "paymentType", s.total, s.status,
  s.voided_at AS "voidedAt", s.voided_by AS "voidedBy", s.created_at AS "createdAt"`;

export const SALE_FROM = `
  FROM sales s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN customers c ON c.id = s.customer_id`;

export const findSaleById = async (id: number, q: Queryable, lock = false): Promise<SaleRow | undefined> => {
  const { rows } = await q.query<SaleRow>(
    `SELECT ${SALE_COLUMNS} ${SALE_FROM} WHERE s.id = $1 ${lock ? "FOR UPDATE OF s" : ""}`,
    [id],
  );
  return rows[0];
};

export const findSaleLines = async (saleId: number, q: Queryable): Promise<SaleLineRow[]> => {
  const { rows } = await q.query<SaleLineRow>(
    `SELECT l.id, l.product_id AS "productId", p.name AS "productName", p.sku,
            l.quantity, l.unit_price AS "unitPrice", l.line_total AS "lineTotal"
     FROM sale_lines l JOIN products p ON p.id = l.product_id
     WHERE l.sale_id = $1 ORDER BY l.id`,
    [saleId],
  );
  return rows;
};
