-- Qué cambia: conteos físicos de inventario (`stock_counts`) con una línea por producto (`stock_count_lines`) y el
-- rastro de lo que movió cada ajuste aplicado (`stock_count_adjustments`).
-- Por qué: bodega programa y registra conteos (todo el inventario o una categoría) y la administración aprueba el
-- ajuste. Al iniciar se guarda una foto del stock físico de cada producto (`expected_quantity`); `difference` es la
-- diferencia contra esa foto. Al aplicar se recalcula contra el stock actual (`applied_difference`): los faltantes
-- bajan lotes por FEFO (vencidos primero) y los sobrantes crean un lote de ajuste; cada movimiento queda en
-- `stock_count_adjustments` (cantidad negativa = descontada de un lote, positiva = lote creado). Módulo nuevo: no
-- estaba en el documento 06 (queda registrado en el README).

CREATE TABLE stock_counts (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title          VARCHAR(120) NOT NULL,
  scheduled_date DATE         NOT NULL,
  scope          VARCHAR(10)  NOT NULL DEFAULT 'ALL' CHECK (scope IN ('ALL', 'CATEGORY')),
  category_id    BIGINT       REFERENCES categories (id),
  status         VARCHAR(12)  NOT NULL DEFAULT 'PLANNED'
                 CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'SUBMITTED', 'APPLIED', 'CANCELLED')),
  note           VARCHAR(400),
  created_by     BIGINT       NOT NULL REFERENCES users (id),
  started_at     TIMESTAMPTZ,
  started_by     BIGINT       REFERENCES users (id),
  submitted_at   TIMESTAMPTZ,
  submitted_by   BIGINT       REFERENCES users (id),
  applied_at     TIMESTAMPTZ,
  applied_by     BIGINT       REFERENCES users (id),
  cancelled_at   TIMESTAMPTZ,
  cancelled_by   BIGINT       REFERENCES users (id),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK ((scope = 'CATEGORY') = (category_id IS NOT NULL))
);
CREATE INDEX stock_counts_status_date_idx ON stock_counts (status, scheduled_date);

CREATE TABLE stock_count_lines (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  count_id           BIGINT  NOT NULL REFERENCES stock_counts (id) ON DELETE CASCADE,
  product_id         BIGINT  NOT NULL REFERENCES products (id),
  -- Stock físico del sistema (products.stock) en el momento de iniciar el conteo.
  expected_quantity  INTEGER NOT NULL CHECK (expected_quantity >= 0),
  counted_quantity   INTEGER CHECK (counted_quantity >= 0),
  difference         INTEGER GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
  -- Diferencia contra el stock actual al aplicar el ajuste (puede diferir de `difference` si hubo ventas).
  applied_difference INTEGER,
  note               VARCHAR(200),
  UNIQUE (count_id, product_id)
);

CREATE TABLE stock_count_adjustments (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  line_id          BIGINT  NOT NULL REFERENCES stock_count_lines (id) ON DELETE CASCADE,
  product_batch_id BIGINT  NOT NULL REFERENCES product_batches (id),
  quantity         INTEGER NOT NULL CHECK (quantity <> 0)
);
CREATE INDEX stock_count_adjustments_line_idx ON stock_count_adjustments (line_id);
