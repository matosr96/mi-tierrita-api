# Registro de cambios · Mi Tierrita API

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/). Fechas en hora de Colombia.

## [Sin publicar] · Reinicio de datos para sembrar producción (9/11/2026)

### Añadido
- `pnpm db:reset` / `pnpm db:reset:prod` (`src/scripts/reset-data.ts`): vacía las tablas de negocio y conserva `users`, `roles` y el control de migraciones. Exige `RESET_DATA_CONFIRM=<marca>` y cada marca se usa una sola vez (tabla `data_resets`), para que un reinicio del servidor no vuelva a borrar. Se usó para sacar de producción el conjunto de prueba del colmado anterior y cargar la semilla de la agropecuaria. Prueba en `tests/reset-data.test.ts`.

## [Sin publicar] · Líneas de producto iguales en la página pública y en el sistema (6/11/2026)

### Añadido
- Migración `0018_lineas_publicas`: cada categoría tiene `code` («01»…«06» solo en las seis líneas públicas; nulo en las internas), `description` y `tags` (subfamilias). La línea 05 pasa a llamarse «Productos agroquímicos», como en la página pública. Las seis líneas iniciales viven en `business-logic/categories/product-lines.ts`; la fuente en ejecución es la tabla `categories`.
- `GET /categories/public` (sin sesión, 60 peticiones por minuto por IP, `Cache-Control` de 5 minutos): las categorías activas con código, solo `code`, `name`, `description` y `tags`, en el orden del código. Lo lee la página pública para que sus líneas sean las mismas del inventario. Montado antes de `authenticate`; `GET /categories` sigue pidiendo sesión.
- `POST` y `PUT /categories` aceptan `description` y `tags` (subfamilia repetida → 400 en `tags[n]`). Pruebas nuevas en `tests/categories.test.ts`.

### Cambiado
- Todo listado de categorías va por código y luego por nombre (`CATEGORY_ORDER`); el desglose por categoría del reporte de inventario sigue ese orden y trae `categoryActive`.
- `pnpm db:seed` busca las líneas por código y después por nombre, les completa el código si la base es anterior a la 0018 y las crea con descripción y subfamilias; el catálogo demo y los proveedores usan «Productos agroquímicos».
- `docs/openapi.yaml` y `README.md` documentan los campos nuevos y la ruta pública.

## [Sin publicar] · Informe del proyecto y totales de D&A (5/11/2026)

### Añadido
- Simulador: `result.investment` trae `depreciationTotal` y `amortizationTotal` (sumas del horizonte: $31.000.000 y $6.500.000 en el ejemplo de la ampliación) para que la app muestre las dos tablas por separado sin sumar. Prueba en `tests/financial-simulator.test.ts`.
- Tita: la herramienta `generar_reporte` acepta `tipo: "scenario"` (solo Administrador) con `proyectoId` opcional y deja la tarjeta «Informe del proyecto» que abre Reportes → Informe con ese escenario (sin id, el ejemplo de la ampliación). `ReportKind` de `tool-kit.ts` gana `scenario`; prueba en `tests/ai.test.ts` (Secretaria rechazada).

## [Sin publicar] · Fase B del brief: simulador financiero (29/10/2026)

### Añadido
- Simulador financiero por unidades (`business-logic/financial/simulator.ts`, función pura `simulate`): Mercado, Competencia, Costos por unidades vendidas con IPC, precio automático con margen sobre el costo, Inversión con depreciación y amortización, Financiación con resumen anual y cobertura, Flujo de caja libre sin deuda, tornado y escenarios pesimista, base y optimista. Es la única fuente de las cifras del simulador.
- `GET /financial/simulator/defaults` y `POST /financial/simulator/calculate`.
- Proyectos guardados (`financial_projects`, migración `0017_simulador_proyectos`): `GET/POST /financial/projects`, `GET /financial/projects/compare`, `GET/PUT/DELETE /financial/projects/:id`; códigos 715 y 716.
- Dos proyectos de ejemplo en `pnpm db:seed` y pruebas en `tests/financial-simulator.test.ts`.

### Cambiado
- Tita (`escenarios_financieros`, `crear_escenario` y el borrador `scenario_explain`, ahora con `projectId`) lee los proyectos del simulador en lugar de los escenarios del capítulo 5.

## [Sin publicar] · Fase A del brief de octubre de 2026

### Añadido
- Tita: respuesta en dos pasos (`POST /ai/chat` con `asincrono: true` → 202 `tareaId`; `GET /ai/mensajes/:tareaId`), códigos 662 y 663.
- Tita: historial de conversaciones por persona (`ai_conversations`, `ai_messages`; `GET/DELETE /ai/conversations`, `POST /ai/conversations/:id/events`), migración `0007_tita_conversaciones`.
- Tita: autocompletado de la pregunta con el modelo rápido (`POST /ai/complete`), contexto de pantalla (`screen`) y hora de Colombia en el prompt.

- Datos de ejemplo: `pnpm db:seed` idempotente (`src/scripts/seed.ts`, `seed-data.ts`) con usuarios por rol, catálogo, lotes, clientes, ventas, abonos, escenarios y chat con adjuntos; `SEED_ON_START` opcional.

- Biblioteca de documentos y enlaces (`library_items`, rutas `/library`, migración `0012_biblioteca_avatar`) y foto de perfil (`PUT/DELETE /users/me/avatar`, `GET /users/:id/avatar`); códigos 690 y 691.

- Búsqueda global (`GET /search?q=` por rol), historial por registro (`audits.entity/entity_id/changes`, `GET /audits/entity/:entity/:id`) y comentarios con «responder a» (`record_comments`, rutas `/comments`), migración `0011_auditoria_detalle_comentarios`; códigos 685 a 688.

- Alarmas personalizadas (`alarms`, `alarm_fires`; rutas `/alarms`, planificador cada minuto con candado en PostgreSQL, evento en vivo `alarm`, archivo `.ics` por alarma y de todas), avisos de vencimiento por rol (`GET /notifications/due`, evento diario `due`) y Web Push (`push_subscriptions`, rutas `/push`, claves VAPID, `pnpm vapid`); migración `0008_alarmas_avisos_push`; códigos 670 a 674. Tita puede preparar alarmas (`crear_alarma`).
- Tita responde a la mención @Tita en el chat del equipo y en los comentarios de un registro (`0013_tita_en_chat`, rutas `PATCH …/tita-actions`).
- Directorio de personas (`GET /users/directory`) y calendario por rol (`GET /calendar`: lotes, cartera, alarmas y cierres de mes).
- Pedidos a proveedor y de cliente (`orders`, `order_lines`; rutas `/orders`, migración `0014_pedidos`; códigos 700 a 704): cada rol solo sus tipos, recepción parcial o completa que registra la compra (lote y stock) en una sola transacción, entrega con la venta que lo cobró, cancelación y totales en el servidor; `listDueOrders` para calendario y avisos. `registerBatch` y `registerPurchase` aceptan el cliente de una transacción en curso.
- Nómina simplificada solo para ADMIN (`payroll_employees`, `payroll_periods`, `payroll_lines`; rutas `/payroll`, migración `0015_nomina`; códigos 705 a 709): empleados, periodos mensuales o quincenales en borrador → aprobado → pagado, salud y pensión del trabajador al 4 % y totales en el servidor; `listUpcomingPayroll` para calendario y avisos. No reemplaza la nómina electrónica de la DIAN.
- Conteos de inventario (`stock_counts`, `stock_count_lines`, `stock_count_adjustments`; rutas `/stock-counts`, migración `0016_conteos_inventario`; códigos 710 a 714): programar, iniciar con la foto del stock, registrar lo contado, enviar y aplicar el ajuste (solo ADMIN) contra el stock actual, con faltantes por FEFO (vencidos primero) y sobrantes como lote de ajuste; `listScheduledCounts` para el calendario.
- Pedidos, nómina y conteos en los avisos por rol (`GET /notifications/due`), en el calendario (`GET /calendar`), en las herramientas de Tita y en `pnpm db:seed`.

### Cambiado
- Tita: el prompt del sistema describe la pantalla desde la que se pregunta y pide atajos `[texto](/ruta)`.

## [0.1.0] · 2026-10-28
- Estado previo a la Fase A: inventario con lotes y FEFO, ventas, cartera, proveedores, finanzas, reportes, auditoría, chat del equipo en vivo y Tita (consultas, acciones confirmadas, adjuntos y recomendaciones).
