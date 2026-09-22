import { ErrorCodes, domainError } from "../../common/index.js";
import { isUniqueViolation, usersDataSource } from "../../data-sources/index.js";
import { hashPassword } from "../../security/index.js";
import { toUserResponse, type CreateUserRequest, type UserResponse } from "../../models/index.js";

/** CU-03 Crear usuario: solo el Administrador; usuario duplicado responde 630. */
export const createUser = async (input: CreateUserRequest): Promise<UserResponse> => {
  const passwordHash = await hashPassword(input.password);
  try {
    const created = await usersDataSource.insert({
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      passwordHash,
      role: input.role,
    });
    return toUserResponse(created);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
