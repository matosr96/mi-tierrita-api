import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

/** GET /docs (público): OpenAPI / Swagger UI (RNF-08). El esquema vive en docs/openapi.yaml. */
const specPath = fileURLToPath(new URL("../../docs/openapi.yaml", import.meta.url));
const spec = parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;

export const docsRouter = Router();
docsRouter.get("/openapi.json", (_req, res) => {
  res.json(spec);
});
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: "Mi Tierrita API" }));
