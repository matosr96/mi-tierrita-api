import { db } from "../../data-sources/index";
import type { CreateContactMessageRequest } from "../../models/index";

/**
 * Guarda el mensaje que dejó un visitante en la página pública. Si llenó el campo trampa (un robot), no se guarda,
 * pero la respuesta es la misma para no darle pistas.
 */
export const createContactMessage = async (input: CreateContactMessageRequest): Promise<void> => {
  if (input.trap) return;
  await db.query(`INSERT INTO contact_messages (name, phone, email, topic, body) VALUES ($1, $2, $3, $4, $5)`, [input.name, input.phone, input.email, input.topic, input.body]);
};
