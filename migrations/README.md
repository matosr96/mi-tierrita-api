# Migraciones

Scripts SQL numerados y versionados que crean y modifican el esquema (RNF-07). Nunca se
sincroniza el esquema automáticamente desde el código.

- Nombre: `NNNN_descripcion.sql` (cuatro dígitos, sin repetir prefijo; revisa `ls migrations/` antes de elegir el número).
- Encabezado obligatorio: qué cambia y por qué.
- Cada migración se aplica en su propia transacción y queda registrada en `schema_migrations`.
- Una migración aplicada no se edita: se crea una nueva que la corrija.

```bash
pnpm db:status    # aplicadas y pendientes
pnpm db:migrate   # aplica las pendientes
```
