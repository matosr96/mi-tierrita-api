import { ErrorCodes, domainError } from "../../common/index";
import { signAccessToken, verifyPassword } from "../../security/index";
import { toUserResponse, type SigninRequest, type SigninResponse } from "../../models/index";
import { findUserByUsername } from "../users/find-user";

/** CU-01 Iniciar sesión: valida contra el hash guardado y emite un token de acceso. */
export const signin = async (input: SigninRequest): Promise<SigninResponse> => {
  const user = await findUserByUsername(input.username);
  // Se compara siempre contra un hash para no revelar por tiempo si el usuario existe
  const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid";
  const ok = await verifyPassword(input.password, hash);
  if (user === undefined || !ok) throw domainError(ErrorCodes.INVALID_CREDENTIALS);
  if (!user.active) throw domainError(ErrorCodes.USER_INACTIVE);

  const token = signAccessToken({ sub: String(user.id), role: user.role, tv: user.tokenVersion });
  return { token, user: toUserResponse(user) };
};
