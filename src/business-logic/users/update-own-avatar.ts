import { ErrorCodes, domainError } from "../../common/index";
import { db } from "../../data-sources/index";
import { toUserResponse, type AvatarUploadRequest, type UserResponse } from "../../models/index";
import { findUserById } from "./find-user";

/** Mi perfil: guarda (o reemplaza) la foto propia. */
export const updateOwnAvatar = async (userId: number, file: AvatarUploadRequest): Promise<UserResponse> => {
  await db.query(`UPDATE users SET avatar = $2, avatar_mime = $3, avatar_updated_at = now() WHERE id = $1`, [userId, file.data, file.mime]);
  const user = await findUserById(userId);
  if (user === undefined) throw domainError(ErrorCodes.USER_NOT_FOUND);
  return toUserResponse(user);
};
