-- Qué cambia: pedidos en una sola tabla con dos tipos (`orders.kind`): a proveedor (SUPPLIER: lo que se espera recibir,
-- con costo esperado y fecha de llegada) y de cliente (CUSTOMER: un encargo con precio acordado y fecha de entrega
-- comprometida), y sus líneas (`order_lines`). Recibir un pedido a proveedor registra la compra con la lógica existente
-- (crea el lote y sube el stock) y acumula `received_quantity` por línea; la recepción parcial deja el pedido en PARTIAL.
-- Entregar un pedido de cliente lo cierra y puede guardar la venta con que se cobró (`sale_id`).
-- Por qué: el brief de octubre de 2026 pide «Pedidos» para el calendario y los avisos («pedidos por vencer»). No estaba
-- en el documento 06; queda registrado en el README (tabla «Estado de la API»).

CREATE TABLE orders (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        VARCHAR(10)   NOT NULL CHECK (kind IN ('SUPPLIER', 'CUSTOMER')),
  supplier_id BIGINT        REFERENCES suppliers (id),
  customer_id BIGINT        REFERENCES customers (id),
  status      VARCHAR(10)   NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PARTIAL', 'RECEIVED', 'DELIVERED', 'CANCELLED')),
  due_date    DATE          NOT NULL,
  note        VARCHAR(500),
  -- Suma de cantidad × precio (cliente) o costo esperado (proveedor); la calcula el servidor
  total       DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_by  BIGINT        NOT NULL REFERENCES users (id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ,
  closed_by   BIGINT        REFERENCES users (id),
  sale_id     BIGINT        REFERENCES sales (id),
  -- Cada tipo lleva su contraparte y solo esa
  CHECK ((kind = 'SUPPLIER' AND supplier_id IS NOT NULL AND customer_id IS NULL)
      OR (kind = 'CUSTOMER' AND customer_id IS NOT NULL AND supplier_id IS NULL)),
  -- PARTIAL y RECEIVED son de proveedor; DELIVERED y la venta, de cliente
  CHECK (kind = 'SUPPLIER' OR status NOT IN ('PARTIAL', 'RECEIVED')),
  CHECK (kind = 'CUSTOMER' OR (status <> 'DELIVERED' AND sale_id IS NULL)),
  -- Un pedido abierto no tiene cierre; uno cerrado (recibido, entregado o cancelado) sí
  CHECK ((status IN ('PENDING', 'PARTIAL')) = (closed_at IS NULL))
);
CREATE INDEX orders_kind_status_due_idx ON orders (kind, status, due_date);
-- Una venta cobra a lo sumo un encargo
CREATE UNIQUE INDEX orders_sale_id_key ON orders (sale_id) WHERE sale_id IS NOT NULL;

CREATE TABLE order_lines (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          BIGINT        NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id        BIGINT        NOT NULL REFERENCES products (id),
  quantity          INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price        DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  -- Proveedor: unidades ya recibidas (lotes creados). Cliente: unidades entregadas (todas al marcar entregado)
  received_quantity INTEGER       NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  CHECK (received_quantity <= quantity),
  UNIQUE (order_id, product_id)
);
