import type { RequestHandler } from "express";
import { parsePageRequest } from "../../common/index";
import { CONTACT_STATUSES, type ContactStatus } from "../../models/index";
import { listContactMessages } from "../../business-logic/contact/index";

/** GET /api/v1/contact-messages?status=NEW|READ|ARCHIVED — ADMIN. */
export const listContactMessagesController: RequestHandler = async (req, res) => {
  const raw = req.query["status"];
  const status = typeof raw === "string" && (CONTACT_STATUSES as readonly string[]).includes(raw) ? (raw as ContactStatus) : undefined;
  res.json(await listContactMessages(parsePageRequest(req.query), { status }));
};
