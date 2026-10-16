import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toUserResponse, type UpdateOwnProfileRequest, type UserResponse } from "../../models/index";
import { findUserById } from "./find-user";

/** Mi perfil: cada persona actualiza su nombre, correo y teléfono. El usuario y el rol solo los cambia el administrador. */
export const updateOwnProfile = async (userId: number, input: UpdateOwnProfileRequest): Promise<UserResponse> => {
  const sets: string[] = [];
  const params: unknown[] = [userId];
  const put = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (input.firstName !== undefined) put("first_name", input.firstName);
  if (input.lastName !== undefined) put("last_name", input.lastName);
  if (input.email !== undefined) put("email", input.email);
  if (input.phone !== undefined) put("phone", input.phone);
  if (sets.length > 0) await db.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $1`, params);
  const user = await findUserById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
