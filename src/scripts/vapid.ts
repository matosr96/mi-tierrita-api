/**
 * Genera un par de claves VAPID para Web Push (brief 2026, punto 14):
 *   pnpm vapid
 * Copie las dos líneas en el .env de la API. La clave privada nunca va al repositorio.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
