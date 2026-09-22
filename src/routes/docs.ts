import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

/** GET /docs (público): OpenAPI / Swagger UI (RNF-08). El esquema vive en docs/openapi.yaml. */
const specPath = join(__dirname, "..", "..", "docs", "openapi.yaml");
const spec = parse(readFileSync(specPath, "utf8")) as Record<string, unknown>;

export const docsRouter = Router();
docsRouter.get("/openapi.json", (_req, res) => {
  res.json(spec);
});
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: "Mi Tierrita API" }));
