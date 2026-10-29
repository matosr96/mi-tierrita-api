import { ErrorCodes, domainError } from "../common/errors";
import { createValidator, queryString } from "../common/validate";
import { ALL_ROLES, isRole, type Role } from "../security/roles";
import { CHAT_ATTACHMENT_MAX_BYTES, CHAT_ATTACHMENT_TYPES } from "./chat";

/** Biblioteca: un documento (archivo en la base) o un enlace. `roles` vacío = lo ven todos los roles. */
export type LibraryKind = "document" | "link";
export const LIBRARY_KINDS: readonly LibraryKind[] = ["document", "link"];

export type LibraryItemRow = {
  id: number;
  kind: LibraryKind;
  title: string;
  description: string;
  url: string | null;
  name: string | null;
  mime: string | null;
  size: number | null;
  roles: Role[];
  createdBy: number;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LibraryItemResponse = {
  id: number;
  kind: LibraryKind;
  title: string;
  description: string;
  url: string | null;
  name: string | null;
  mime: string | null;
  size: number | null;
  roles: Role[];
  createdBy: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
};

export const toLibraryItemResponse = (row: LibraryItemRow): LibraryItemResponse => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  description: row.description,
  url: row.url,
  name: row.name,
  mime: row.mime,
  size: row.size,
  roles: row.roles,
  createdBy: { id: row.createdBy, name: row.createdByName },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const LIBRARY_TITLE_RULE = { min: 1, max: 140 };
export const LIBRARY_DESCRIPTION_RULE = { max: 400 };
export const LIBRARY_URL_MAX = 2000;

/** Solo http(s) con host: nada de javascript:, data: ni rutas relativas. */
export const isHttpUrl = (value: string): boolean => {
  if (value.length > LIBRARY_URL_MAX) return false;
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname !== "";
  } catch {
    return false;
  }
};

type Issue = { path: string; message: string };

/** Lista de roles: subconjunto de ADMIN/SALES/WAREHOUSE, sin repetidos; vacía = todos. */
const parseRoles = (raw: unknown, issues: Issue[]): Role[] | undefined => {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    issues.push({ path: "roles", message: "Debe ser una lista de roles" });
    return undefined;
  }
  const out: Role[] = [];
  for (const r of raw) {
    if (!isRole(r)) {
      issues.push({ path: "roles", message: `Debe ser uno de: ${ALL_ROLES.join(", ")}` });
      return undefined;
    }
    if (!out.includes(r)) out.push(r);
  }
  // Marcar los tres roles equivale a no restringir.
  return out.length === ALL_ROLES.length ? [] : out;
};

export type CreateLinkRequest = { title: string; description: string; url: string; roles: Role[] };

export const parseCreateLink = (body: unknown): CreateLinkRequest => {
  const v = createValidator(body);
  const title = v.string("title", LIBRARY_TITLE_RULE);
  const description = v.string("description", LIBRARY_DESCRIPTION_RULE, false) ?? "";
  const url = v.string("url", { min: 1, max: LIBRARY_URL_MAX });
  if (url !== undefined && !isHttpUrl(url)) v.custom("url", "Debe ser una dirección http:// o https://");
  const issues: Issue[] = [];
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const roles = parseRoles(data["roles"], issues) ?? [];
  issues.forEach((i) => v.custom(i.path, i.message));
  v.done();
  return { title: title!, description, url: url!, roles };
};

export type LibraryUploadRequest = { title: string; description: string; roles: Role[]; name: string; mime: string; data: Buffer };

const decodeHeader = (raw: string | undefined): string => {
  try {
    return decodeURIComponent(raw ?? "").trim();
  } catch {
    return "";
  }
};

/**
 * Un documento llega como cuerpo binario (igual que los adjuntos del chat y con sus mismos tipos): tipo en
 * Content-Type y, codificados con encodeURIComponent, `X-File-Name`, `X-Title`, `X-Description` y `X-Roles`
 * (roles separados por coma; vacío = todos).
 */
export const parseLibraryUpload = (input: { body: unknown; contentType: string | undefined; fileName: string | undefined; title: string | undefined; description: string | undefined; roles: string | undefined }): LibraryUploadRequest => {
  const issues: Issue[] = [];
  const mime = (input.contentType ?? "").split(";")[0]!.trim().toLowerCase();
  if (!CHAT_ATTACHMENT_TYPES.includes(mime) || mime.startsWith("audio/")) issues.push({ path: "file", message: "Tipo de archivo no permitido (fotos, PDF, Excel, Word, CSV o texto)" });
  let name = decodeHeader(input.fileName).replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "").slice(-200);
  if (name === "") issues.push({ path: "name", message: "Falta el nombre del archivo" });
  const title = decodeHeader(input.title).slice(0, LIBRARY_TITLE_RULE.max + 1);
  if (title === "") issues.push({ path: "title", message: "Campo obligatorio" });
  else if (title.length > LIBRARY_TITLE_RULE.max) issues.push({ path: "title", message: `Máximo ${LIBRARY_TITLE_RULE.max} caracteres` });
  const description = decodeHeader(input.description);
  if (description.length > LIBRARY_DESCRIPTION_RULE.max) issues.push({ path: "description", message: `Máximo ${LIBRARY_DESCRIPTION_RULE.max} caracteres` });
  const rolesRaw = decodeHeader(input.roles);
  const roles = parseRoles(rolesRaw === "" ? [] : rolesRaw.split(",").map((r) => r.trim()), issues) ?? [];
  const data = Buffer.isBuffer(input.body) ? input.body : Buffer.alloc(0);
  if (data.length === 0) issues.push({ path: "file", message: "El archivo está vacío" });
  if (data.length > CHAT_ATTACHMENT_MAX_BYTES) issues.push({ path: "file", message: "Máximo 10 MB por archivo" });
  if (issues.length > 0) throw domainError(ErrorCodes.VALIDATION, issues);
  name = name || "archivo";
  return { title, description: description.slice(0, LIBRARY_DESCRIPTION_RULE.max), roles, name, mime, data };
};

export type UpdateLibraryItemRequest = { title?: string | undefined; description?: string | undefined; url?: string | undefined; roles?: Role[] | undefined };

/** Título, descripción, enlace (solo en enlaces; lo comprueba la lógica) y roles. El archivo no se reemplaza: se sube otro ítem. */
export const parseUpdateLibraryItem = (body: unknown): UpdateLibraryItemRequest => {
  const v = createValidator(body);
  const title = v.string("title", LIBRARY_TITLE_RULE, false);
  const description = v.string("description", LIBRARY_DESCRIPTION_RULE, false);
  const url = v.string("url", { min: 1, max: LIBRARY_URL_MAX }, false);
  if (url !== undefined && !isHttpUrl(url)) v.custom("url", "Debe ser una dirección http:// o https://");
  const issues: Issue[] = [];
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const roles = parseRoles(data["roles"], issues);
  issues.forEach((i) => v.custom(i.path, i.message));
  if (!["title", "description", "url", "roles"].some((f) => v.has(f))) v.custom("body", "Debe enviar al menos un campo a modificar");
  v.done();
  return { title, description, url, roles };
};

export type LibraryQuery = { kind?: LibraryKind | undefined; q?: string | undefined };

export const parseLibraryQuery = (query: Record<string, unknown>): LibraryQuery => {
  const kind = query["kind"];
  return { kind: kind === "document" || kind === "link" ? kind : undefined, q: queryString(query["q"]) };
};

/** Imágenes, PDF y texto se muestran en línea (el visor de la app); lo demás se descarga, nunca se interpreta en el navegador. */
export const libraryDisposition = (mime: string): "inline" | "attachment" =>
  /^(image\/(jpeg|png|webp|gif)|application\/pdf|text\/(plain|csv))$/.test(mime) ? "inline" : "attachment";
