export const BATCH_COLUMNS = `
  b.id, b.product_id AS "productId", p.name AS "productName",
  b.supplier_id AS "supplierId", s.name AS "supplierName",
  b.quantity, b.quantity_remaining AS "quantityRemaining", b.unit_cost AS "unitCost",
  b.expires_at AS "expiresAt", b.created_at AS "createdAt"`;

export const BATCH_FROM = `
  FROM product_batches b
  JOIN products p ON p.id = b.product_id
  LEFT JOIN suppliers s ON s.id = b.supplier_id`;
