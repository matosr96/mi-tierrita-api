import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { PaymentTypes, toSaleResponse, type CreateSaleRequest, type SaleDetailResponse } from "../../models/index";
import { lockProductById } from "../products/find-product";
import { lockCustomerById } from "../customers/find-customer";
import { allocateStockFefo } from "./allocate-stock-fefo";
import { nextInvoiceNumber } from "./next-invoice-number";
import { findSaleById, findSaleLines } from "./sale-queries";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * CU-09 Registrar venta. Todo ocurre en una transacción: congela el precio de cada línea
 * con el precio de venta actual, calcula el total en el servidor (RF-03.2), descuenta stock
 * por FEFO (CU-08), valida cupo si es a crédito (CU-11) y asigna el correlativo de factura.
 * Los productos se bloquean en orden de id para evitar interbloqueos entre ventas simultáneas.
 */
export const registerSale = async (userId: number, input: CreateSaleRequest): Promise<SaleDetailResponse> => {
  if (input.paymentType === PaymentTypes.CREDIT && input.customerId === undefined) {
    throw domainError(ErrorCodes.VALIDATION, [{ path: "customerId", message: "Obligatorio en una venta a crédito" }]);
  }

  // Líneas repetidas del mismo producto se consolidan
  const quantities = new Map<number, number>();
  for (const line of input.lines) quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  const productIds = [...quantities.keys()].sort((a, b) => a - b);

  return db.transaction(async (client) => {
    const customer = input.customerId === undefined ? undefined : await lockCustomerById(input.customerId, client);
    if (input.customerId !== undefined) {
      if (customer === undefined) throw domainError(ErrorCodes.CUSTOMER_NOT_FOUND);
      if (!customer.active) throw domainError(ErrorCodes.CUSTOMER_INACTIVE);
    }

    const lines: { productId: number; quantity: number; unitPrice: number; lineTotal: number }[] = [];
    for (const productId of productIds) {
      const product = await lockProductById(productId, client);
      if (product === undefined) throw domainError(ErrorCodes.PRODUCT_NOT_FOUND, { productId });
      if (!product.active) throw domainError(ErrorCodes.PRODUCT_INACTIVE, { productId });
      const quantity = quantities.get(productId) ?? 0;
      lines.push({ productId, quantity, unitPrice: product.salePrice, lineTotal: round2(product.salePrice * quantity) });
    }
    const total = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));

    if (input.paymentType === PaymentTypes.CREDIT && customer !== undefined) {
      if (customer.balance + total > customer.creditLimit + 0.000001) {
        throw domainError(ErrorCodes.CREDIT_LIMIT_EXCEEDED, {
          creditLimit: customer.creditLimit,
          balance: customer.balance,
          total,
        });
      }
      await client.query(`UPDATE customers SET balance = balance + $2 WHERE id = $1`, [customer.id, total]);
    }

    const invoiceNumber = await nextInvoiceNumber(client);
    const { rows: saleRows } = await client.query<{ id: number }>(
      `INSERT INTO sales (invoice_number, customer_id, user_id, payment_type, total)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [invoiceNumber, input.customerId ?? null, userId, input.paymentType, total],
    );
    const saleId = saleRows[0]?.id;
    if (saleId === undefined) throw new Error("INSERT de venta no devolvió id");

    for (const line of lines) {
      const { rows: lineRows } = await client.query<{ id: number }>(
        `INSERT INTO sale_lines (sale_id, product_id, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [saleId, line.productId, line.quantity, line.unitPrice, line.lineTotal],
      );
      const lineId = lineRows[0]?.id;
      if (lineId === undefined) throw new Error("INSERT de línea no devolvió id");
      const allocations = await allocateStockFefo(line.productId, line.quantity, client);
      for (const a of allocations) {
        await client.query(
          `INSERT INTO sale_line_batch_allocations (sale_line_id, product_batch_id, quantity) VALUES ($1, $2, $3)`,
          [lineId, a.productBatchId, a.quantity],
        );
      }
    }

    const sale = await findSaleById(saleId, client);
    if (sale === undefined) throw new Error("Venta recién creada no encontrada");
    return { ...toSaleResponse(sale), lines: await findSaleLines(saleId, client) };
  });
};
