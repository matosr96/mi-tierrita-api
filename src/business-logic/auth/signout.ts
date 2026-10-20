import { db } from "../../data-sources/index";
import { closeChatStreamsOf } from "../chat/index";

/** CU-02 Cerrar sesión: incrementa la versión de token, invalidando todas las sesiones. */
export const signout = async (userId: number): Promise<void> => {
  await db.query(`UPDATE users SET token_version = token_version + 1, last_seen_at = now(), last_signout_at = now() WHERE id = $1`, [userId]);
  // Las conexiones en vivo de esta instancia se cortan ya; las de otras instancias, en su próximo latido.
  closeChatStreamsOf(userId);
};
