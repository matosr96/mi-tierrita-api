/**
 * Crea el primer usuario ADMIN. No hay registro público: el resto de usuarios se
 * crea por la API (CU-03).
 *   pnpm create-admin <username> <password> [firstName] [lastName]
 */
import { db } from "../data-sources/db";
import { findUserByUsername } from "../business-logic/users/find-user";
import { hashPassword } from "../security/password";
import { Roles } from "../security/roles";

const main = async () => {
  const [username, password, firstName = "Administrador", lastName = "Mi Tierrita"] = process.argv.slice(2).filter((arg) => arg !== "--");
  if (username === undefined || password === undefined) {
    throw new Error("Uso: pnpm create-admin <username> <password> [firstName] [lastName]");
  }
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

  const existing = await findUserByUsername(username);
  if (existing !== undefined) throw new Error(`El usuario ${username} ya existe`);

  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO users (first_name, last_name, username, password_hash, role_id)
     VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5))
     RETURNING id`,
    [firstName, lastName, username, await hashPassword(password), Roles.ADMIN],
  );
  console.log(`Administrador creado: id=${rows[0]?.id} username=${username}`);
};

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => void db.close());
