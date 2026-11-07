-- Qué cambia: `categories` gana `code` (dos dígitos, único, nulo en las categorías internas), `description` y `tags`
-- (subfamilias). Renombra «Agroquímicos» a «Productos agroquímicos» y asigna código, descripción y subfamilias a
-- las seis líneas de la página pública (catálogo v4.1) buscándolas por nombre.
-- Por qué: la landing y el inventario tenían cada uno su lista de líneas y ya se habían separado (la línea 05 se
-- llamaba distinto). Desde ahora la tabla `categories` es la única fuente: la página pública la lee por
-- `GET /categories/public` (activas con código) y el administrador sigue libre de renombrar, desactivar o crear
-- categorías; las que nazcan sin código son internas y no salen en la página. Extensión del documento 05/06
-- (queda registrada en el README).

ALTER TABLE categories
  ADD COLUMN code        VARCHAR(2),
  ADD COLUMN description VARCHAR(200),
  ADD COLUMN tags        TEXT[]       NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX categories_code_unique ON categories (code) WHERE code IS NOT NULL;

-- La línea 05 se llamaba «Agroquímicos» en la semilla y «Productos agroquímicos» en la página pública.
UPDATE categories
   SET name = 'Productos agroquímicos'
 WHERE lower(name) = lower('Agroquímicos')
   AND NOT EXISTS (SELECT 1 FROM categories c2 WHERE lower(c2.name) = lower('Productos agroquímicos'));

UPDATE categories c
   SET code = l.code, description = l.description, tags = l.tags
  FROM (VALUES
    ('01', 'Alimentos balanceados',    'Concentrados para ganado, cerdos, aves y mascotas.',                         ARRAY['Ganado', 'Cerdos', 'Aves', 'Mascotas']),
    ('02', 'Medicina veterinaria',     'Vacunas, desparasitantes y vitaminas, con control de lote y vencimiento.',   ARRAY['Vacunas', 'Desparasitantes', 'Vitaminas']),
    ('03', 'Semillas y fertilizantes', 'Maíz, pastos y abonos para cada temporada.',                                  ARRAY['Maíz', 'Pastos', 'Abonos']),
    ('04', 'Aves de corral',           'Pollitas ponedoras y pollos de engorde.',                                     ARRAY['Ponedoras', 'Engorde']),
    ('05', 'Productos agroquímicos',   'Herbicidas, insecticidas y fungicidas de uso agrícola.',                      ARRAY['Herbicidas', 'Insecticidas', 'Fungicidas']),
    ('06', 'Ferretería agrícola',      'Machetes, alambre, mangueras y herramienta de finca.',                        ARRAY['Machetes', 'Alambre', 'Mangueras'])
  ) AS l(code, name, description, tags)
 WHERE lower(c.name) = lower(l.name)
   AND c.code IS NULL;
