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
| Validación | A mano, con el validador de `common/validate.ts` en cada DTO de entrada |
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
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL en local |
| `DATABASE_URL` | Cadena única del Postgres gestionado; si está, sustituye a las cinco anteriores |
| `DB_SSL` | TLS de la conexión: `disable`, `require` o `verify` |
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
  routes/          un archivo por entidad: cablea cada ruta con su rol permitido y su controlador
  controllers/     capa de presentación: un archivo por operación; valida la entrada, llama a la
                   lógica y traduce a respuesta HTTP (solo entiende de HTTP)
  business-logic/  reglas del dominio y SQL: un archivo por operación, agrupadas por entidad
  models/          forma de las filas, DTOs de entrada/salida y funciones parseX() de validación
  data-sources/    pool de conexiones a PostgreSQL, transacciones y traducción de errores de la base
  common/          códigos de error, paginación, validador, fechas
  scripts/         migrador y creación del primer administrador
migrations/        SQL numerado y versionado
docs/openapi.yaml  contrato público de la API (todos los endpoints)
tests/             pruebas unitarias (validación, errores, paginación, token, motor financiero)
```

Una petición recorre `routes` → `controllers` → `business-logic` → `data-sources` (pool) → PostgreSQL.

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
9. **Contadores denormalizados con bloqueo.** `products.stock` y `customers.balance` se mueven en la misma
   transacción que la operación que los cambia, con `SELECT ... FOR UPDATE` sobre la fila (RNF-04).

### Cómo agregar una entidad

Replica el módulo `categories` (el más pequeño): `models/<entidad>.ts` (tipos + `parseX`) →
`business-logic/<entidad>/<operacion>.ts` (reglas + SQL) → `controllers/<entidad>/<operacion>.ts` →
`routes/<entidad>.ts` con su `authorize(...)` → montar en `routes/index.ts` después de `authenticate` →
documentar en `docs/openapi.yaml` → migración si cambia el esquema.

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
| 623 | Abono mayor al saldo de cartera | 409 |
| 625 | Producto inactivo | 409 |
| 626 | Cliente inactivo | 409 |
| 630 | Recurso duplicado (unique) | 409 |
| 631 | Categoría con productos asociados | 409 |
| 640 | Demasiados intentos de acceso | 429 |
| 650 | Escenario financiero inválido | 422 |

## Estado de la API

Los 44 endpoints del documento 06 están implementados y documentados en `/docs`.

| Módulo | Endpoints | Casos de uso |
|---|---|---|
| Salud y documentación | `GET /health`, `GET /docs`, `GET /docs/openapi.json` | — |
| Autenticación | `POST /auth/signin`, `POST /auth/signout`, `GET /auth/me` | CU-01, CU-02 |
| Usuarios | `POST/GET /users`, `GET /users/:id`, `PUT /users/me/password` | CU-03, CU-04 |
| Categorías | `POST/GET /categories`, `PUT/DELETE /categories/:id` | — |
| Productos e inventario | `POST/GET /products`, `GET/PUT/DELETE /products/:id`, `POST/GET /products/:id/batches`, `GET /batches/expiring` | CU-05, CU-06, CU-07 |
| Ventas | `POST/GET /sales`, `GET /sales/:id`, `POST /sales/:id/void` | CU-08 (FEFO), CU-09, CU-10, CU-11, RF-03.4 |
| Clientes y cartera | `POST/GET /customers`, `GET/PUT /customers/:id`, `GET /customers/:id/balance`, `POST /customers/:id/payments` | CU-12 |
| Proveedores | `POST/GET /suppliers`, `PUT /suppliers/:id`, `POST /suppliers/:id/purchases` | CU-13 |
| Finanzas | `POST/GET /financial/scenarios`, `GET .../compare`, `GET .../:id`, `.../amortization`, `.../sensitivity`, `.../sensitivity/bivariate`, `.../tornado` | CU-14 a CU-17 |
| Auditoría | `GET /audits` | CU-18 |
| Reportes | `GET /reports/sales`, `GET /reports/inventory`, `GET /reports/receivables` | CU-19, CU-20 |

### Reglas de negocio implementadas

- **FEFO (RF-02.6).** Una venta descuenta del lote con vencimiento más próximo, saltando los lotes ya
  vencidos; puede consumir varios lotes y deja la asignación en `sale_line_batch_allocations`. Si no
  alcanza responde 620 con `available` (unidades no vencidas).
- **Precio congelado y total en el servidor (RF-03.1, RF-03.2).** El cliente solo envía producto y cantidad.
- **Crédito (RF-04.2).** Con `paymentType: CREDIT` el cliente es obligatorio; se rechaza con 621 si
  `saldo + total > cupo`. El saldo sube con la venta y baja con cada abono; un abono mayor al saldo
  responde 623.
- **Anulación (RF-03.4).** Solo ADMIN. Devuelve cada cantidad al lote de origen, repone el stock y, si fue a
  crédito, baja la cartera (sin dejarla negativa). La venta queda `VOIDED` con fecha y usuario; no se borra.
- **Correlativo de factura.** `FV-AAAA-NNNNNN` con contador propio por año y bloqueo de fila.
- **Cartera vencida (supuesto).** El modelo no tiene fechas de vencimiento por venta, así que se considera
  vencida la cartera de un cliente con saldo mayor que cero cuya última venta a crédito tiene más de
  `overdueDays` días (30 por defecto, configurable en la consulta).
- **Finanzas (RF-06, RNF-10).** El motor de `business-logic/financial/engine.ts` es un porte 1:1 de
  `1 Motor de calculo.py`; las pruebas reproducen los escenarios A, B, C y D de `2 Resultados del modelo.json`
  y las tablas 8 a 12 del capítulo 5. Los resultados se guardan al crear el escenario (RF-06.8) y la
  sensibilidad, la grilla bivariante y el tornado se calculan sobre los supuestos guardados.
- **Reportes (RF-08.4).** Todos se agregan en SQL; nunca se traen listas completas a memoria.

## Decisiones pendientes con el negocio

- Política exacta de anulación de una venta (RF-03.4): plazo y si queda registro o se borra.
- Si la Secretaria ve el reporte de ventas completo o solo el de su turno (CU-10, CU-19). Hoy ve todo;
  el filtro `?userId=` de `GET /sales` permite restringirlo desde el frontend mientras se decide.
- Si una venta puede consumir lotes ya vencidos. Hoy el FEFO los salta y quedan visibles en
  `GET /batches/expiring` y en el reporte de inventario para darles de baja.

## Producción

El backend se empaqueta como imagen de contenedor ([Dockerfile](Dockerfile)); CI
([.github/workflows/ci.yml](.github/workflows/ci.yml)) hace typecheck, pruebas, migraciones contra un
PostgreSQL efímero, build y construye la imagen. En producción la API corre detrás de un proxy HTTPS
y la base es un servicio gestionado aparte con respaldos automáticos; la API no guarda estado entre
peticiones, así que puede reiniciarse sin pérdida.
