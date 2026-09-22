import { ErrorCodes, domainError } from "../../common/index";
import { toProductResponse, type ProductResponse } from "../../models/index";
import { findProductById } from "./find-product";

export const getProduct = async (id: number): Promise<ProductResponse> => {
  const product = await findProductById(id);
  if (product === undefined) throw domainError(ErrorCodes.PRODUCT_NOT_FOUND);
  return toProductResponse(product);
};
