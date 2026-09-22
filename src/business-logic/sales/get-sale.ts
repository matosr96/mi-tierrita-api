import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toSaleResponse, type SaleDetailResponse } from "../../models/index";
import { findSaleById, findSaleLines } from "./sale-queries";

export const getSale = async (id: number): Promise<SaleDetailResponse> => {
  const sale = await findSaleById(id, db);
  if (sale === undefined) throw domainError(ErrorCodes.SALE_NOT_FOUND);
  return { ...toSaleResponse(sale), lines: await findSaleLines(id, db) };
};
