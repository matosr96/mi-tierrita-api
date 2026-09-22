# Mi Tierrita API — guía para sesiones de trabajo

Backend REST de Mi Tierrita SIG (Express 5 + PostgreSQL 16 + TypeScript, ESM). El diseño canónico
vive en la documentación técnica del TCC (`~/Desktop/TCC Ingenieria Economica/6 Documentacion tecnica`):
01 arquitectura, 03 requisitos, 04 casos de uso, 05 modelo de datos, 06 diseño de la API, 08 infraestructura.
No inventar endpoints ni tablas que no estén ahí sin dejarlo escrito en el README.

## Comandos

`pnpm dev` (puerto 4300, prefijo `/api/v1`) · `pnpm typecheck` · `pnpm test` · `pnpm db:migrate` ·
`pnpm db:status` · `pnpm create-admin <usuario> <clave>` · `docker compose up -d db`.

## Reglas de oro

1. **Capas con un solo motivo de cambio**: `routes/` solo HTTP (validar entrada, traducir a respuesta),
   `business-logic/` solo dominio (jamás importa Express ni escribe SQL), `data-sources/` único lugar
   con SQL, `models/` solo forma de datos y esquemas zod. Un archivo por operación + barrels.
2. **Toda ruta nueva nace protegida**: se monta en `routes/index.ts` después de `authenticate` y
   restringe con `authorize(...)` según la tabla de roles del documento 06. Identidad desde
   `requireAuth(req)`, nunca desde el body.
3. **Errores solo por código**: `throw domainError(ErrorCodes.X)`; nuevos códigos se agregan a
   `common/errors.ts` y a la tabla del README. Nunca `res.status(...).json({ message: "texto libre" })`.
4. **Auditoría intocable**: la registra el middleware; nunca duplicarla en rutas ni loguear contraseñas.
5. **Esquema solo por migraciones** numeradas en `migrations/` con encabezado "qué cambia / por qué".
   Una migración aplicada no se edita.
6. **Dinero de negocio en `DECIMAL(12,2)`**; el módulo financiero usa `DOUBLE PRECISION`. Los totales
   e indicadores se calculan en el servidor; los que envíe el cliente se ignoran.
7. **Contadores denormalizados** (`products.stock`, `customers.balance`) se mueven en la misma
   transacción que la operación que los cambia, con bloqueo de fila (`SELECT ... FOR UPDATE`).
8. Listados `{ count, page, pages, items }` con `parsePageRequest`/`toPageResponse`.
9. Sin clases en dominio: funciones flecha exportadas. Copiar el módulo `categories` antes que inventar.
10. Cada módulo nuevo actualiza `docs/openapi.yaml` y la tabla "Estado de la API" del README.
