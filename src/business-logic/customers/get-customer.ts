import { ErrorCodes, domainError } from "../../common/index";
import { toCustomerResponse, type CustomerResponse } from "../../models/index";
import { findCustomerById } from "./find-customer";

export const getCustomer = async (id: number): Promise<CustomerResponse> => {
  const customer = await findCustomerById(id);
  if (customer === undefined) throw domainError(ErrorCodes.CUSTOMER_NOT_FOUND);
  return toCustomerResponse(customer);
};
