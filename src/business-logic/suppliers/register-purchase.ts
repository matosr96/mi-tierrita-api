import { ErrorCodes, domainError } from "../../common/index";
import { db, type Queryable } from "../../data-sources/index";
import type { CreatePurchaseRequest, ProductBatchResponse } from "../../models/index";
import { registerBatch } from "../batches/register-batch";
import { findSupplierById } from "./find-supplier";

/**
 * CU-13 Registrar compra a proveedor: crea el lote asociado al proveedor y sube el stock.
 * `q`: el cliente de una transacción en curso (la recepción de un pedido registra todas sus compras en una sola).
 */
export const registerPurchase = async (supplierId: number, input: CreatePurchaseRequest, q: Queryable = db): Promise<ProductBatchResponse> => {
  const supplier = await findSupplierById(supplierId, q);
  if (supplier === undefined) throw domainError(ErrorCodes.SUPPLIER_NOT_FOUND);
  return registerBatch({
    productId: input.productId,
    quantity: input.quantity,
    unitCost: input.unitCost,
    expiresAt: input.expiresAt,
    supplierId,
  }, q);
};
