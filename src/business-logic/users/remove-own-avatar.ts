import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toUserResponse, type UserResponse } from "../../models/index";
import { findUserById } from "./find-user";

/** Mi perfil: quita la foto propia (vuelven las iniciales). */
export const removeOwnAvatar = async (userId: number): Promise<UserResponse> => {
  await db.query(`UPDATE users SET avatar = NULL, avatar_mime = NULL, avatar_updated_at = NULL WHERE id = $1`, [userId]);
  const user = await findUserById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
