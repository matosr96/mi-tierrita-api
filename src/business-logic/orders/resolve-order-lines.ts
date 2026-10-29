import { ErrorCodes, domainError } from "../../common/index";
import type { Queryable } from "../../data-sources/index";
import { OrderKinds, type OrderKind, type OrderLineRequest } from "../../models/index";
import { orderTotal } from "./order-total";

export type PricedLine = { productId: number; quantity: number; unitPrice: number };

/**
 * Pone precio a las líneas: el que se acordó si vino; si no, el precio de venta (pedido de cliente) o el de compra
 * (pedido a proveedor) vigente del producto. 601 si un producto no existe, 625 si está inactivo.
 */
export const resolveOrderLines = async (kind: OrderKind, lines: readonly OrderLineRequest[], q: Queryable): Promise<{ lines: PricedLine[]; total: number }> => {
  const ids = lines.map((l) => l.productId);
  const { rows } = await q.query<{ id: number; active: boolean; purchasePrice: number; salePrice: number }>(
    `SELECT id, active, purchase_price AS "purchasePrice", sale_price AS "salePrice" FROM products WHERE id = ANY($1::bigint[])`,
    [ids],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const priced = lines.map((l): PricedLine => {
    const product = byId.get(l.productId);
    if (product === undefined) throw domainError(ErrorCodes.PRODUCT_NOT_FOUND, { productId: l.productId });
    if (!product.active) throw domainError(ErrorCodes.PRODUCT_INACTIVE, { productId: l.productId });
    const fallback = kind === OrderKinds.CUSTOMER ? product.salePrice : product.purchasePrice;
    return { productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice ?? fallback };
  });
  return { lines: priced, total: orderTotal(priced) };
};

export const insertOrderLines = async (orderId: number, lines: readonly PricedLine[], q: Queryable): Promise<void> => {
  await q.query(
    `INSERT INTO order_lines (order_id, product_id, quantity, unit_price)
     SELECT $1, x.product_id, x.quantity, x.unit_price
     FROM unnest($2::bigint[], $3::int[], $4::numeric[]) AS x (product_id, quantity, unit_price)`,
    [orderId, lines.map((l) => l.productId), lines.map((l) => l.quantity), lines.map((l) => l.unitPrice)],
  );
};
