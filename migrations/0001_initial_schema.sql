-- 0001_initial_schema
-- Qué cambia: crea el esquema completo de Mi Tierrita SIG según el documento 05
--   (modelo de datos) y sus índices/unicidades previstos.
-- Por qué: es la primera migración; define todas las tablas de una vez para que el
--   modelo quede revisable como un todo. Las migraciones siguientes solo modifican.
-- Convenciones: ids BIGINT autoincrementales; dinero de negocio DECIMAL(12,2) (RNF-03);
--   el módulo financiero usa DOUBLE PRECISION; tablas con histórico usan active en vez
--   de borrado físico; las tablas de registro (lotes, ventas, auditoría, financieras)
--   no se desactivan ni se editan.

-- ---------------------------------------------------------------- seguridad
CREATE TABLE roles (
  id   SMALLINT PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE
);

INSERT INTO roles (id, name) VALUES
  (1, 'ADMIN'),
  (2, 'SALES'),
  (3, 'WAREHOUSE');

CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name    VARCHAR(80)  NOT NULL,
  last_name     VARCHAR(80)  NOT NULL,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role_id       SMALLINT     NOT NULL REFERENCES roles (id),
  token_version INTEGER      NOT NULL DEFAULT 0,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_unique ON users (lower(username));

-- ---------------------------------------------------------------- catálogo
CREATE TABLE categories (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(80) NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_unique ON categories (lower(name));

CREATE TABLE suppliers (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  tax_id     VARCHAR(30),
  phone      VARCHAR(30),
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           VARCHAR(120)  NOT NULL,
  sku            VARCHAR(40)   NOT NULL,
  category_id    BIGINT        NOT NULL REFERENCES categories (id),
  purchase_price DECIMAL(12,2) NOT NULL CHECK (purchase_price >= 0),
  sale_price     DECIMAL(12,2) NOT NULL CHECK (sale_price >= 0),
  -- Contador denormalizado: se mantiene en la misma transacción que crea lotes o
  -- asigna lotes a ventas; nunca se recalcula aparte.
  stock          INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX products_sku_unique ON products (lower(sku));
CREATE INDEX products_category_id_idx ON products (category_id);

-- Lotes con vencimiento: base del FEFO (RF-02.6 / CU-08)
CREATE TABLE product_batches (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id         BIGINT        NOT NULL REFERENCES products (id),
  supplier_id        BIGINT        REFERENCES suppliers (id),
  quantity           INTEGER       NOT NULL CHECK (quantity > 0),
  quantity_remaining INTEGER       NOT NULL CHECK (quantity_remaining >= 0),
  unit_cost          DECIMAL(12,2) NOT NULL CHECK (unit_cost >= 0),
  expires_at         DATE          NOT NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (quantity_remaining <= quantity)
);
CREATE INDEX product_batches_product_expires_idx ON product_batches (product_id, expires_at);

-- ---------------------------------------------------------------- clientes y cartera
CREATE TABLE customers (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         VARCHAR(120)  NOT NULL,
  document_id  VARCHAR(30)   NOT NULL,
  phone        VARCHAR(30),
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  -- Cartera vigente: sube con cada venta a crédito (CU-11), baja con cada abono (CU-12)
  balance      DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (document_id)
);

CREATE TABLE customer_payments (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT        NOT NULL REFERENCES customers (id),
  user_id     BIGINT        NOT NULL REFERENCES users (id),
  amount      DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX customer_payments_customer_id_idx ON customer_payments (customer_id);

-- ---------------------------------------------------------------- ventas
-- Correlativo visible de factura, independiente del id, con bloqueo por fila para
-- poder reiniciar por año si se pide más adelante.
CREATE TABLE invoice_counters (
  year        INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sales (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_number VARCHAR(20)   NOT NULL,
  customer_id    BIGINT        REFERENCES customers (id),
  user_id        BIGINT        NOT NULL REFERENCES users (id),
  payment_type   VARCHAR(10)   NOT NULL CHECK (payment_type IN ('CASH', 'CREDIT')),
  total          DECIMAL(12,2) NOT NULL CHECK (total >= 0),
  status         VARCHAR(10)   NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOIDED')),
  voided_at      TIMESTAMPTZ,
  voided_by      BIGINT        REFERENCES users (id),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (invoice_number),
  CHECK (payment_type <> 'CREDIT' OR customer_id IS NOT NULL)
);
CREATE INDEX sales_customer_id_idx ON sales (customer_id);
CREATE INDEX sales_user_id_idx     ON sales (user_id);
CREATE INDEX sales_created_at_idx  ON sales (created_at);

CREATE TABLE sale_lines (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id    BIGINT        NOT NULL REFERENCES sales (id),
  product_id BIGINT        NOT NULL REFERENCES products (id),
  quantity   INTEGER       NOT NULL CHECK (quantity > 0),
  -- Precio congelado al momento de la venta (RF-03.1)
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(12,2) NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX sale_lines_sale_id_idx ON sale_lines (sale_id);

-- Trazabilidad de qué lote cubrió qué línea: inventario valorizado y reversión de anulaciones
CREATE TABLE sale_line_batch_allocations (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_line_id     BIGINT  NOT NULL REFERENCES sale_lines (id),
  product_batch_id BIGINT  NOT NULL REFERENCES product_batches (id),
  quantity         INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX sale_line_batch_allocations_line_idx  ON sale_line_batch_allocations (sale_line_id);
CREATE INDEX sale_line_batch_allocations_batch_idx ON sale_line_batch_allocations (product_batch_id);

-- ---------------------------------------------------------------- auditoría (solo inserción)
CREATE TABLE audits (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users (id),
  method     VARCHAR(10)  NOT NULL,
  resource   VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX audits_user_id_idx    ON audits (user_id);
CREATE INDEX audits_resource_idx   ON audits (resource);
CREATE INDEX audits_created_at_idx ON audits (created_at);

-- ---------------------------------------------------------------- finanzas (separado del operativo)
-- Supuestos de entrada con columnas explícitas para lo que se consulta, más un JSON
-- de respaldo con el resto (mismos campos que BASE del motor de cálculo en Python).
CREATE TABLE financial_scenarios (
  id                            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                          VARCHAR(160)     NOT NULL,
  user_id                       BIGINT           NOT NULL REFERENCES users (id),
  fixed_investment              DOUBLE PRECISION NOT NULL CHECK (fixed_investment >= 0),
  credit_pct                    DOUBLE PRECISION NOT NULL CHECK (credit_pct BETWEEN 0 AND 1),
  term_months                   INTEGER          NOT NULL CHECK (term_months > 0),
  sales_increase_pct            DOUBLE PRECISION NOT NULL,
  additional_expenses_month     DOUBLE PRECISION NOT NULL CHECK (additional_expenses_month >= 0),
  credit_covers_working_capital BOOLEAN          NOT NULL DEFAULT FALSE,
  base_assumptions              JSONB            NOT NULL,
  -- Resultado calculado y cacheado (RF-06.8); se recalcula solo si cambian los supuestos
  results                       JSONB            NOT NULL,
  created_at                    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX financial_scenarios_user_id_idx ON financial_scenarios (user_id);

-- Detalle desnormalizado para ordenar/filtrar por año sin parsear JSON
CREATE TABLE financial_scenario_cash_flows (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scenario_id              BIGINT           NOT NULL REFERENCES financial_scenarios (id) ON DELETE CASCADE,
  year                     INTEGER          NOT NULL CHECK (year >= 0),
  margin                   DOUBLE PRECISION NOT NULL,
  expenses                 DOUBLE PRECISION NOT NULL,
  working_capital_delta    DOUBLE PRECISION NOT NULL,
  salvage                  DOUBLE PRECISION NOT NULL,
  working_capital_recovery DOUBLE PRECISION NOT NULL,
  net_flow                 DOUBLE PRECISION NOT NULL,
  investor_flow            DOUBLE PRECISION NOT NULL,
  UNIQUE (scenario_id, year)
);

CREATE TABLE financial_scenario_amortization (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scenario_id BIGINT           NOT NULL REFERENCES financial_scenarios (id) ON DELETE CASCADE,
  month       INTEGER          NOT NULL CHECK (month > 0),
  installment DOUBLE PRECISION NOT NULL,
  interest    DOUBLE PRECISION NOT NULL,
  principal   DOUBLE PRECISION NOT NULL,
  balance     DOUBLE PRECISION NOT NULL,
  UNIQUE (scenario_id, month)
);
