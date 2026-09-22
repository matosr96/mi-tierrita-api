import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { PaymentTypes, SaleStatuses, toSaleResponse, type SaleDetailResponse } from "../../models/index";
import { findSaleById, findSaleLines } from "./sale-queries";

type AllocationRow = { productBatchId: number; productId: number; quantity: number };

/**
 * RF-03.4 Anular venta (solo ADMIN). Devuelve cada cantidad al lote de origen usando las
 * asignaciones guardadas, repone el stock del producto y, si fue a crédito, baja la cartera
 * del cliente. La venta no se borra: queda con estado VOIDED, fecha y usuario que la anuló.
 * Política de plazo pendiente de definir con el negocio (documento 00); por ahora sin límite.
 */
export const voidSale = async (saleId: number, voidedBy: number): Promise<SaleDetailResponse> =>
  db.transaction(async (client) => {
    const sale = await findSaleById(saleId, client, true);
    if (sale === undefined) throw domainError(ErrorCodes.SALE_NOT_FOUND);
    if (sale.status === SaleStatuses.VOIDED) throw domainError(ErrorCodes.SALE_ALREADY_VOIDED);

    const { rows: allocations } = await client.query<AllocationRow>(
      `SELECT a.product_batch_id AS "productBatchId", l.product_id AS "productId", a.quantity
       FROM sale_line_batch_allocations a JOIN sale_lines l ON l.id = a.sale_line_id
       WHERE l.sale_id = $1
       ORDER BY l.product_id, a.product_batch_id`,
      [saleId],
    );
    for (const a of allocations) {
      await client.query(`UPDATE product_batches SET quantity_remaining = quantity_remaining + $2 WHERE id = $1`, [a.productBatchId, a.quantity]);
      await client.query(`UPDATE products SET stock = stock + $2, updated_at = now() WHERE id = $1`, [a.productId, a.quantity]);
    }

    if (sale.paymentType === PaymentTypes.CREDIT && sale.customerId !== null) {
      // Si el cliente ya abonó parte, la cartera no puede quedar negativa
      await client.query(`UPDATE customers SET balance = GREATEST(balance - $2, 0) WHERE id = $1`, [sale.customerId, sale.total]);
    }

    await client.query(`UPDATE sales SET status = 'VOIDED', voided_at = now(), voided_by = $2 WHERE id = $1`, [saleId, voidedBy]);
    const voided = await findSaleById(saleId, client);
    if (voided === undefined) throw new Error("Venta anulada no encontrada");
    return { ...toSaleResponse(voided), lines: await findSaleLines(saleId, client) };
  });
