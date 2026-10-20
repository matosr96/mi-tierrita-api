# Mi Tierrita API

Backend REST de **Mi Tierrita SIG**, el sistema de información gerencial de una agropecuaria en Sahagún, Córdoba:
inventario con lotes y vencimientos, punto de venta, clientes con cartera, proveedores, usuarios y roles, auditoría,
reportes, evaluación financiera del proyecto de ampliación, chat del equipo, contactos de la página pública y **Tita**,
la asistente con IA (Claude, de Anthropic).

Este repositorio implementa la documentación técnica del Trabajo Colaborativo Contextualizado (carpeta
`6 Documentacion tecnica`): arquitectura del backend (01), requisitos (03), casos de uso (04),
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
| IA | SDK oficial de Anthropic (`@anthropic-ai/sdk`), opcional según `ANTHROPIC_API_KEY` |

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
| `pnpm test` | Pruebas unitarias (no necesitan base de datos ni clave de IA) |
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
| `ANTHROPIC_API_KEY` | Clave de Claude (Anthropic) para el asistente. Opcional: sin ella las rutas `/ai` responden 660 y la app oculta la IA |
| `AI_MODEL` / `AI_FAST_MODEL` | Modelo del asistente y de los textos cortos (`claude-sonnet-5-5` / `claude-haiku-5-5`) |
| `BUSINESS_TZ` | Zona horaria del negocio para "hoy", cortes de reportes y vencimientos (`America/Bogota`) |
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
                   (ai/: Tita — herramientas de consulta y de acción, recomendaciones, borradores, facturas)
  models/          forma de las filas, DTOs de entrada/salida y funciones parseX() de validación
  data-sources/    pool de conexiones a PostgreSQL, transacciones y traducción de errores de la base
  common/          códigos de error, paginación, validador, fechas
  scripts/         migrador y creación del primer administrador
migrations/        SQL numerado y versionado
docs/openapi.yaml  contrato público de la API (todos los endpoints)
tests/             pruebas unitarias (validación, errores, paginación, token, motor financiero, auditoría,
                   permisos y adjuntos de Tita)
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
   fecha y, con la cabecera `X-AI-Suggested: 1`, la marca `ai_suggested`); las rutas no auditan por su cuenta.
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
| 608 | Contacto del sitio no encontrado | 404 |
| 609 | Mensaje o adjunto del chat no encontrado (o de un privado ajeno: no se revela que exista) | 404 |
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
| 660 | IA no configurada (falta `ANTHROPIC_API_KEY`) | 503 |
| 661 | El proveedor de IA falló o no respondió | 502 |

## Estado de la API

Los 44 endpoints del documento 06 están implementados y documentados en `/docs`. Las migraciones
`0002_figma_v4` y `0003_chat_privado_presencia` agregan 9 más que pide el prototipo de escritorio v4.2 (Mi perfil,
historial de reportes, chat del equipo con privados y presencia, y contactos del sitio), `0004_auditoria_sugerido_ia`
acompaña las 5 rutas de Tita (`/ai`) `0005_chat_acuses_hilos_adjuntos` amplía el chat con 11 rutas más (acuses,
hilos, fijados, búsqueda, adjuntos y avisos en vivo) y `0006_chat_editar_eliminar` agrega 2 (editar y eliminar). Ninguno estaba en el documento 06; quedan registrados aquí.

| Módulo | Endpoints | Casos de uso |
|---|---|---|
| Salud y documentación | `GET /health`, `GET /docs`, `GET /docs/openapi.json` | — |
| Autenticación | `POST /auth/signin`, `POST /auth/signout`, `GET /auth/me` | CU-01, CU-02 |
| Usuarios | `POST/GET /users`, `GET /users/:id`, `PUT /users/me/password`, `PUT /users/me` (perfil propio) | CU-03, CU-04, prototipo 15 |
| Categorías | `POST/GET /categories`, `PUT/DELETE /categories/:id` | — |
| Productos e inventario | `POST/GET /products`, `GET/PUT/DELETE /products/:id`, `POST/GET /products/:id/batches`, `GET /batches/expiring` | CU-05, CU-06, CU-07 |
| Ventas | `POST/GET /sales`, `GET /sales/:id`, `POST /sales/:id/void` | CU-08 (FEFO), CU-09, CU-10, CU-11, RF-03.4 |
| Clientes y cartera | `POST/GET /customers`, `GET/PUT /customers/:id`, `GET /customers/:id/balance`, `POST /customers/:id/payments` | CU-12 |
| Proveedores | `POST/GET /suppliers`, `PUT /suppliers/:id`, `POST /suppliers/:id/purchases` | CU-13 |
| Finanzas | `POST/GET /financial/scenarios`, `GET .../compare`, `GET .../:id`, `.../amortization`, `.../sensitivity`, `.../sensitivity/bivariate`, `.../tornado` | CU-14 a CU-17 |
| Auditoría | `GET /audits` | CU-18 |
| Reportes | `GET /reports/sales` (incluye `averageTicket`), `GET /reports/inventory`, `GET /reports/receivables`, `GET/POST /reports/exports` (historial de descargas) | CU-19, CU-20, prototipo 09 |
| Chat del equipo | `GET/POST /chat/messages` (canal general o privado con `?with=` / `recipientId`; hilo con `?thread=` / `threadRootId`; cita con `replyToId`; `?after=`, `?before=` y `?around=` para lo nuevo, el historial o saltar a un mensaje; `clientId` evita duplicados), `PATCH /chat/messages/:id` (editar, solo el autor), `DELETE /chat/messages/:id` (eliminar: el autor; en #general también ADMIN), `GET /chat/messages/state?ids=`, `GET /chat/messages/:id/receipts` (solo el autor), `PUT/DELETE /chat/messages/:id/pin`, `GET /chat/pins`, `POST /chat/read`, `GET /chat/search`, `POST /chat/attachments` (binario, 10 MB), `GET /chat/attachments/:id`, `GET /chat/stream` (avisos en vivo, SSE), `GET /chat/team` (en línea, no leídos, menciones) | prototipo 11 + extensión |
| Tita (asistente de IA) | `GET /ai/status`, `GET /ai/briefing` (recomendaciones del rol + párrafo de IA), `POST /ai/chat` (herramientas de consulta y de acción con los permisos del rol; acepta adjuntos: imagen, PDF o texto; hasta 24 MB), `POST /ai/drafts`, `POST /ai/invoice` (ADMIN, WAREHOUSE). Las herramientas de acción no escriben: validan con el mismo `parseX` del endpoint y devuelven la petición exacta; la app la ejecuta contra el endpoint real solo si la persona confirma, con `X-AI-Suggested: 1` (auditoría `ai_suggested`). No crea usuarios ni maneja contraseñas. Tope de 40 consultas cada 5 min por persona; las rutas `/ai` no se auditan porque no escriben. La búsqueda de clientes y productos ignora tildes y mayúsculas | extensión |
| Contactos del sitio | `POST /contact` (público, 5 por hora por IP, campo trampa `website`), `GET /contact-messages`, `PATCH /contact-messages/:id` | prototipo 12 |

### Reglas de negocio implementadas

- **Hora del negocio.** "Hoy", los cortes de reportes y los vencimientos se cuentan en `BUSINESS_TZ`
  (America/Bogota); cada sesión de PostgreSQL abre en esa zona, así una venta de las 8 p. m. es del mismo día.
- **Stock vendible.** Cada producto trae `stock` (físico, incluye lotes vencidos aún en bodega) y `availableStock`
  (lotes no vencidos): lo que FEFO puede vender hoy. Un lote que ya llega vencido se rechaza con 400.
- **Búsqueda.** Clientes y productos se buscan sin importar tildes ni mayúsculas ("maria perez" encuentra a "María Pérez").
- **Tita.** Las herramientas de consulta usan la misma lógica y los mismos roles que sus endpoints. Las de acción no
  escriben: validan con el `parseX` del endpoint y devuelven la petición exacta; la app la ejecuta contra la API real
  solo si la persona confirma. Las recomendaciones del día (reponer, rotar, cobrar, sin rotación) se calculan en SQL sin
  IA; la IA solo las prioriza y redacta. El contenido de imágenes y documentos se trata como datos, nunca como
  instrucciones. Las rutas `/ai` tienen un tope de 40 consultas cada 5 minutos por persona.

- **Chat y presencia.** El canal general tiene `recipient_id` nulo; un mensaje privado lo lleva y solo lo ven sus
  dos participantes. Cada petición autenticada actualiza `users.last_seen_at` (como mucho cada 20 s, fuera de la
  auditoría); en línea = actividad en los últimos 90 s sin un cierre de sesión posterior.
  - **Acuses (`chat_receipts`).** Al enviar, cada destinatario (el equipo activo en #general; la otra persona en un
    privado) recibe un acuse. *Entregado* cuando su app recibe el mensaje (aviso en vivo, consulta del equipo o de la
    conversación); *visto* cuando tiene la conversación a la vista (`POST /chat/read`, que no se audita). Los chulitos
    del autor: enviado / entregado a todos / visto por todos (las cuentas desactivadas no cuentan). El detalle por
    persona (`/receipts`) solo lo consulta el autor.
  - **Citas, hilos y respuesta privada.** Se cita un mensaje de la misma conversación; la única excepción es responder
    por privado al autor de un mensaje de #general (la respuesta no aparece en el canal). Un hilo se abre sobre un
    mensaje de la conversación principal (sin hilos anidados) y sus respuestas no salen en ella; la raíz trae el resumen
    (respuestas, sin leer, participantes).
  - **Fijados.** En #general fija y desfija solo ADMIN; en un privado, cualquiera de los dos. Máximo 10 por
    conversación; las respuestas de hilos no se fijan.
  - **Menciones.** `@usuario` (y `@todos` / `@equipo` en #general) solo cuentan para quien puede ver el mensaje.
  - **Adjuntos.** Fotos, PDF, Excel, Word, CSV y texto, hasta 10 MB y 5 por mensaje; se guardan en la base
    (`chat_attachments`). Solo los descarga quien puede ver el mensaje; los subidos y no enviados se borran a las 24 h.
  - **Editar y eliminar.** Solo el autor edita (queda `editedAt`; las menciones se recalculan). Elimina el autor y,
    en #general, también ADMIN; el mensaje conserva su lugar, sus acuses y su hilo, pero pierde texto, menciones,
    adjuntos (también el archivo) y fijado, y deja de contar como no leído. No se cita ni se busca un eliminado.
  - **Sin duplicados.** La app manda un `clientId` (UUID) por envío; un reintento devuelve el mismo mensaje.
  - **Tiempo real.** `GET /chat/stream` (Server-Sent Events, token en la cabecera) avisa de mensajes nuevos, cambios
    de acuses, fijados y lecturas solo a quien puede ver la conversación; el aviso no trae la conversación, la app la
    pide por REST. Entre instancias viaja por `LISTEN/NOTIFY` de PostgreSQL (`chat_events`); si esa conexión se cae, se
    entrega en la instancia local. La conexión se corta si la sesión vence o se cierra.

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
- Desactivar cuentas y cambiar roles: no hay endpoint todavía (pendiente P-01 de la auditoría).
- Si Bodega puede crear y editar proveedores: la API lo permite y la interfaz no lo ofrece (pendiente P-02).

## Producción

El backend se empaqueta como imagen de contenedor ([Dockerfile](Dockerfile)); CI
([.github/workflows/ci.yml](.github/workflows/ci.yml)) hace typecheck, pruebas, migraciones contra un
PostgreSQL efímero, build y construye la imagen. En producción la API corre detrás de un proxy HTTPS
y la base es un servicio gestionado aparte con respaldos automáticos; la API no guarda estado entre
peticiones, así que puede reiniciarse sin pérdida.

## Licencias

### Código del proyecto

© 2026 Karina Redondo Sáez, Alexa Patricia Ricardo Lozano y Edgar Alexander Matos Rivera. **Todos los derechos
reservados.** Mi Tierrita SIG es un Trabajo Colaborativo Contextualizado del programa de Ingeniería de Software de la
Universidad de Cartagena. El código se puede consultar en este repositorio, pero no se concede permiso para usarlo,
copiarlo, modificarlo ni distribuirlo sin autorización escrita de los autores (por eso `package.json` declara
`"license": "UNLICENSED"`). El texto completo está en [LICENSE](LICENSE). El motor financiero es un porte del modelo de cálculo del mismo trabajo y tiene la misma reserva.

### Dependencias

Las dependencias directas de producción y sus licencias:

| Paquete | Licencia |
|---|---|
| express, cors, helmet, express-rate-limit | MIT |
| pg | MIT |
| jsonwebtoken | MIT |
| swagger-ui-express | MIT (incluye swagger-ui-dist, Apache-2.0) |
| @anthropic-ai/sdk | MIT |
| bcryptjs | BSD-3-Clause |
| dotenv | BSD-2-Clause |
| yaml | ISC |

Entre las 111 dependencias de producción (incluidas las transitivas) hay licencias MIT, ISC, BSD-2-Clause, BSD-3-Clause,
Apache-2.0 y Unlicense; todas permiten este uso. El detalle actualizado se obtiene con `pnpm licenses list --prod`.

### Servicios externos

Tita usa la API de Claude de Anthropic cuando hay `ANTHROPIC_API_KEY`. El SDK es MIT; el uso del servicio se rige por
los términos comerciales de Anthropic de la cuenta que aporta la clave, no por la licencia de este repositorio.
