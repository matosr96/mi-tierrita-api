import { db } from "../../data-sources/index";
import type { OrderDetailResponse } from "../../models/index";
import type { Role } from "../../security/roles";
import { findOrderFor, loadOrderDetail } from "./order-queries";

/** Detalle con líneas: 700 si no existe, 613 si el rol no maneja ese tipo de pedido. */
export const getOrder = async (id: number, role: Role): Promise<OrderDetailResponse> => {
  await findOrderFor(id, role, db);
  return loadOrderDetail(id, db);
};
