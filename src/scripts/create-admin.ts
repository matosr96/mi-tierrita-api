/**
 * Crea el primer usuario ADMIN. No hay registro público: el resto de usuarios se
 * crea por la API (CU-03).
 *   pnpm create-admin <username> <password> [firstName] [lastName]
 */
import { db } from "../data-sources/db.js";
import { usersDataSource } from "../data-sources/users.js";
import { hashPassword } from "../security/password.js";
import { Roles } from "../security/roles.js";

const main = async () => {
  const [username, password, firstName = "Administrador", lastName = "Mi Tierrita"] = process.argv.slice(2).filter((arg) => arg !== "--");
  if (username === undefined || password === undefined) {
    throw new Error("Uso: pnpm create-admin <username> <password> [firstName] [lastName]");
  }
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");

  const existing = await usersDataSource.findByUsername(username);
  if (existing !== undefined) throw new Error(`El usuario ${username} ya existe`);

  const user = await usersDataSource.insert({
    firstName,
    lastName,
    username,
    passwordHash: await hashPassword(password),
    role: Roles.ADMIN,
  });
  console.log(`Administrador creado: id=${user.id} username=${user.username}`);
};

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => void db.close());
