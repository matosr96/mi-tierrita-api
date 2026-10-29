import { ErrorCodes, domainError } from "../../common/index";
import type { Queryable } from "../../data-sources/index";
import { findCustomerById } from "../customers/find-customer";
import { findSupplierById } from "../suppliers/find-supplier";

/** El proveedor del pedido debe existir (605). */
export const checkSupplier = async (supplierId: number, q: Queryable): Promise<void> => {
  if ((await findSupplierById(supplierId, q)) === undefined) throw domainError(ErrorCodes.SUPPLIER_NOT_FOUND);
};

/** El cliente del encargo debe existir (604) y estar activo (626). */
export const checkCustomer = async (customerId: number, q: Queryable): Promise<void> => {
  const customer = await findCustomerById(customerId, q);
  if (customer === undefined) throw domainError(ErrorCodes.CUSTOMER_NOT_FOUND);
  if (!customer.active) throw domainError(ErrorCodes.CUSTOMER_INACTIVE);
};
