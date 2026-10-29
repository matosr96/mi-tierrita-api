# Registro de cambios · Mi Tierrita API

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/). Fechas en hora de Colombia.

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
