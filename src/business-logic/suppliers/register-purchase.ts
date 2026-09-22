import { ErrorCodes, domainError } from "../../common/index";
import type { CreatePurchaseRequest, ProductBatchResponse } from "../../models/index";
import { registerBatch } from "../batches/register-batch";
import { findSupplierById } from "./find-supplier";

/** CU-13 Registrar compra a proveedor: crea el lote asociado al proveedor y sube el stock. */
export const registerPurchase = async (supplierId: number, input: CreatePurchaseRequest): Promise<ProductBatchResponse> => {
  const supplier = await findSupplierById(supplierId);
  if (supplier === undefined) throw domainError(ErrorCodes.SUPPLIER_NOT_FOUND);
  return registerBatch({
    productId: input.productId,
    quantity: input.quantity,
    unitCost: input.unitCost,
    expiresAt: input.expiresAt,
    supplierId,
  });
};
