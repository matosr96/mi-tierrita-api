# Mi Tierrita API

Backend REST de **Mi Tierrita SIG**, el sistema de información gerencial de un negocio de barrio:
inventario con lotes y vencimientos, punto de venta, clientes con cartera, proveedores, usuarios y
roles, auditoría, reportes y evaluación financiera del proyecto de ampliación.

Este repositorio implementa la documentación técnica del proyecto (carpeta
`6 Documentacion tecnica` del TCC): arquitectura del backend (01), requisitos (03), casos de uso (04),
modelo de datos (05), diseño de la API (06) e infraestructura del backend (08).

## Stack

| Componente | Tecnología |
|---|---|
| Framework HTTP | Express 5 (Node.js 22, TypeScript) |
| Base de datos | PostgreSQL 16, cliente `pg` directo (sin ORM) |
| Autenticación | JWT (HS256) + bcrypt |
| Validación | Esquemas `zod` sobre cada DTO de entrada |
| Esquema de base | Migraciones SQL versionadas en `migrations/` |
| Documentación | OpenAPI 3.1 servido con Swagger UI en `/docs` |
| Pruebas | `node:test` |

## Puesta en marcha (local)

```bash
pnpm install
cp .env.example .env            # ajusta si hace falta
docker compose up -d db         # PostgreSQL 16 en localhost:5433
pnpm db:migrate                 # aplica migrations/*.sql
pnpm create-admin admin 'una-clave-segura'
pnpm dev                        # http://localhost:4300/api/v1 · docs en /docs
```

Comandos:

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor con recarga (`tsx watch`) |
| `pnpm build` / `pnpm start` | Compila a `build/` y ejecuta |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Pruebas unitarias (no necesitan base de datos) |
| `pnpm db:migrate` / `pnpm db:status` | Aplica o lista migraciones |
| `pnpm create-admin <usuario> <clave>` | Crea el primer ADMIN (no hay registro público) |
| `docker compose up --build` | API + base de datos en contenedores |

## Variables de entorno

Ningún valor sensible va en el código ni en la imagen. Ver [.env.example](.env.example).

| Variable | Propósito |
|---|---|
| `PORT` | Puerto donde escucha el proceso (4300) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL |
| `JWT_SECRET` | Firma de los tokens; mínimo 32 caracteres, sin valor por defecto |
| `JWT_EXPIRES_IN` | Vigencia del token (`8h`) |
| `CORS_ORIGINS` | Dominios del frontend permitidos, separados por coma |

## Arquitectura

API REST en **arquitectura por capas**. Una petición entra por `routes/`, pasa a `business-logic/`
y esta usa `data-sources/` para hablar con PostgreSQL. Ninguna capa se salta a otra.

```
src/
  server/          arranque, configuración, manejador de errores, middleware de auditoría
  security/        roles, bcrypt, JWT, middleware de autenticación, matriz de autorización
  routes/          capa de rutas: un archivo por operación, agrupadas por entidad (solo HTTP)
  business-logic/  reglas del dominio: un archivo por operación, agrupadas por entidad
  models/          forma de las filas, DTOs de entrada/salida y esquemas de validación
  data-sources/    acceso a PostgreSQL agrupado por entidad; único lugar con SQL
  common/          códigos de error, paginación, validación
  scripts/         migrador y creación del primer administrador
migrations/        SQL numerado y versionado
docs/openapi.yaml  contrato público de la API
tests/             pruebas unitarias
```

### Reglas que se cumplen en todo el código

1. **Toda ruta nace protegida.** En [src/routes/index.ts](src/routes/index.ts) solo `POST /auth/signin`
   se monta antes del middleware `authenticate`; todo lo demás exige token y restringe por rol con
   `authorize(...)`. La identidad sale siempre de `requireAuth(req)`, nunca del body.
2. **El dato guardado nunca cruza la frontera HTTP.** Cada entidad tiene su `toXResponse`; la
   contraseña y la versión de token jamás salen en una respuesta.
3. **Errores como código de dominio.** La lógica lanza `domainError(ErrorCodes.X)` y el manejador
   único responde `{ "message": "<código>" }` con el estado HTTP correspondiente. Nunca un stack trace.
4. **Auditoría automática.** El middleware registra cada escritura exitosa (usuario, método, recurso,
   fecha); las rutas no auditan por su cuenta.
5. **Listados uniformes.** `?page=` (base 1) y `?limit=` (10, máximo 100) responden
   `{ count, page, pages, items }`.
6. **Los cálculos importantes los hace el servidor.** Totales de venta e indicadores financieros que
   lleguen del cliente se ignoran y se recalculan.
7. **Sin clases en el dominio:** funciones flecha exportadas, un archivo por operación y barrels por carpeta.
8. `snake_case` en la base, `camelCase` en TypeScript y en el JSON de la API (los SELECT hacen el alias).

### Cómo agregar una entidad

Replica el módulo `categories` (el más pequeño): `models/<entidad>.ts` → `data-sources/<entidad>.ts`
→ `business-logic/<entidad>/<operacion>.ts` → `routes/<entidad>/<operacion>.ts` → montar en
`routes/index.ts` después de `authenticate` → documentar en `docs/openapi.yaml` → migración si cambia
el esquema.

## Códigos de error

| Código | Significado | HTTP |
|---|---|---|
| 400 | Datos de entrada mal formados (trae `details`) | 400 |
| 404 | Ruta inexistente | 404 |
| 500 | Error interno | 500 |
| 601 | Producto no encontrado | 404 |
| 602 | Categoría no encontrada | 404 |
| 603 | Usuario no encontrado | 404 |
| 604 | Cliente no encontrado | 404 |
| 605 | Proveedor no encontrado | 404 |
| 606 | Venta no encontrada | 404 |
| 607 | Escenario financiero no encontrado | 404 |
| 610 | Credenciales inválidas | 401 |
| 611 | Token ausente o inválido | 401 |
| 612 | Usuario inactivo | 401 |
| 613 | Rol insuficiente (trae `requiredRoles`) | 403 |
| 620 | Stock insuficiente | 409 |
| 621 | Cupo de crédito excedido | 409 |
| 622 | La venta ya estaba anulada | 409 |
| 630 | Recurso duplicado (unique) | 409 |
| 631 | Categoría con productos asociados | 409 |
| 640 | Demasiados intentos de acceso | 429 |
| 650 | Escenario financiero inválido | 422 |

## Estado de la API

Catálogo completo en el documento 06. Implementado hasta ahora:

| Módulo | Endpoints | Estado |
|---|---|---|
| Salud y documentación | `GET /health`, `GET /docs` | Listo |
| Autenticación | `POST /auth/signin`, `POST /auth/signout`, `GET /auth/me` | Listo (CU-01, CU-02) |
| Usuarios | `POST/GET /users`, `GET /users/:id`, `PUT /users/me/password` | Listo (CU-03, CU-04) |
| Categorías | `POST/GET /categories`, `PUT/DELETE /categories/:id` | Listo |
| Productos e inventario | `/products`, `/products/:id/batches`, `/batches/expiring` | Pendiente (CU-05 a CU-08) |
| Ventas | `/sales`, `/sales/:id/void` | Pendiente (CU-09 a CU-11, FEFO) |
| Clientes y cartera | `/customers`, `/customers/:id/balance`, `/customers/:id/payments` | Pendiente (CU-12) |
| Proveedores | `/suppliers`, `/suppliers/:id/purchases` | Pendiente (CU-13) |
| Finanzas | `/financial/scenarios` y sensibilidad | Pendiente (CU-14 a CU-17; portar `1 Motor de calculo.py`) |
| Auditoría | `GET /audits` | Registro listo; consulta pendiente (CU-18) |
| Reportes | `/reports/sales`, `/reports/inventory`, `/reports/receivables` | Pendiente (CU-19, CU-20) |

El esquema de base de datos de **todos** los módulos ya está creado en
[migrations/0001_initial_schema.sql](migrations/0001_initial_schema.sql).

## Decisiones pendientes con el negocio

- Política exacta de anulación de una venta (RF-03.4): plazo y si queda registro o se borra.
- Si la Secretaria ve el reporte de ventas completo o solo el de su turno (CU-10, CU-19).

## Producción

El backend se empaqueta como imagen de contenedor ([Dockerfile](Dockerfile)); CI
([.github/workflows/ci.yml](.github/workflows/ci.yml)) hace typecheck, pruebas, migraciones contra un
PostgreSQL efímero, build y construye la imagen. En producción la API corre detrás de un proxy HTTPS
y la base es un servicio gestionado aparte con respaldos automáticos; la API no guarda estado entre
peticiones, así que puede reiniciarse sin pérdida.
