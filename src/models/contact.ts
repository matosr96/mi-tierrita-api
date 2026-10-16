import { createValidator } from "../common/validate";
import { EMAIL_RULE, PHONE_RULE } from "./users";

/** Mensajes del formulario de la página pública (prototipo 12). */
export const CONTACT_STATUSES = ["NEW", "READ", "ARCHIVED"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export type ContactMessageRow = { id: number; name: string; phone: string | null; email: string | null; topic: string | null; body: string; status: ContactStatus; createdAt: Date };

export type ContactMessageResponse = Omit<ContactMessageRow, "createdAt"> & { createdAt: string };

export const toContactMessageResponse = (row: ContactMessageRow): ContactMessageResponse => ({ ...row, createdAt: row.createdAt.toISOString() });

export type CreateContactMessageRequest = { name: string; phone: string | null; email: string | null; topic: string | null; body: string; trap: boolean };

/**
 * Formulario público: nombre, al menos un medio para responder (teléfono o correo) y el mensaje.
 * `website` es un campo trampa que las personas no ven; si llega lleno, el mensaje se descarta en silencio.
 */
export const parseCreateContactMessage = (body: unknown): CreateContactMessageRequest => {
  const v = createValidator(body);
  const name = v.string("name", { min: 2, max: 100 });
  const phone = v.string("phone", PHONE_RULE, false);
  const email = v.string("email", EMAIL_RULE, false);
  const topic = v.string("topic", { min: 1, max: 80 }, false);
  const text = v.string("body", { min: 5, max: 2000 });
  const website = v.string("website", { max: 200 }, false);
  if (phone === undefined && email === undefined && !v.issues().some((i) => i.path === "phone" || i.path === "email")) {
    v.custom("phone", "Deje un teléfono o un correo para poder responderle");
  }
  v.done();
  return { name: name!, phone: phone ?? null, email: email?.toLowerCase() ?? null, topic: topic ?? null, body: text!, trap: Boolean(website) };
};

export type UpdateContactMessageRequest = { status: ContactStatus };

export const parseUpdateContactMessage = (body: unknown): UpdateContactMessageRequest => {
  const v = createValidator(body);
  const status = v.oneOf("status", CONTACT_STATUSES);
  v.done();
  return { status: status! };
};
