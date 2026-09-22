import { ErrorCodes, domainError } from "../../common/index";
import { db, isUniqueViolation } from "../../data-sources/index";
import { hashPassword } from "../../security/index";
import { toUserResponse, type CreateUserRequest, type UserResponse } from "../../models/index";
import { findUserById } from "./find-user";

/** CU-03 Crear usuario: solo el Administrador; usuario duplicado responde 630. */
export const createUser = async (input: CreateUserRequest): Promise<UserResponse> => {
  const passwordHash = await hashPassword(input.password);
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO users (first_name, last_name, username, password_hash, role_id)
       VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5))
       RETURNING id`,
      [input.firstName, input.lastName, input.username, passwordHash, input.role],
    );
    const id = rows[0]?.id;
    if (id === undefined) throw new Error("INSERT de usuario no devolvió id");
    const created = await findUserById(id);
    if (created === undefined) throw new Error("Usuario recién creado no encontrado");
    return toUserResponse(created);
  } catch (err) {
    if (isUniqueViolation(err)) throw domainError(ErrorCodes.DUPLICATE_RESOURCE);
    throw err;
  }
};
