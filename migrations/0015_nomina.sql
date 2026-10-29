-- 0015 · Nómina simplificada (empleados, periodos y líneas de liquidación)
--
-- Qué cambia:
--   1. payroll_employees: las personas a quienes la tienda les paga nómina. No todas tienen cuenta en el sistema
--      (user_id es opcional). `base_salary` es el salario mensual pactado; `pay_frequency` dice si se le paga cada
--      mes o cada quincena.
--   2. payroll_periods: un periodo de pago (mensual o quincenal) con sus fechas, su estado (DRAFT borrador →
--      APPROVED aprobado → PAID pagado), quién lo creó, aprobó y pagó, y los totales devengado, deducciones y neto,
--      que la API recalcula en cada cambio (nunca los manda el cliente). Un periodo por frecuencia y fecha de inicio.
--   3. payroll_lines: la liquidación de cada empleado en el periodo. Todos los valores en pesos enteros
--      (DECIMAL(12,2) por la regla de dinero de negocio): salario base del periodo, horas extra/recargos,
--      bonificaciones, auxilio de transporte, salud y pensión del trabajador, otros descuentos y los totales.
-- Por qué: módulo de Nómina pedido por el negocio en la Fase A de octubre de 2026 (no estaba en el documento 06).
-- Es una liquidación simplificada: no reemplaza la nómina electrónica de la DIAN ni calcula prestaciones sociales ni
-- aportes del empleador. Ningún valor legal que cambie cada año (salario mínimo, auxilio de transporte) vive en el
-- esquema ni en el código: el auxilio lo escribe la persona con el valor del decreto vigente.

CREATE TABLE payroll_employees (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name    VARCHAR(80)   NOT NULL,
  last_name     VARCHAR(80)   NOT NULL,
  document_id   VARCHAR(20)   NOT NULL UNIQUE,
  position      VARCHAR(80)   NOT NULL,
  base_salary   DECIMAL(12,2) NOT NULL CHECK (base_salary > 0),
  pay_frequency VARCHAR(10)   NOT NULL CHECK (pay_frequency IN ('MONTHLY', 'BIWEEKLY')),
  active        BOOLEAN       NOT NULL DEFAULT TRUE,
  user_id       BIGINT        UNIQUE REFERENCES users (id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX payroll_employees_frequency_idx ON payroll_employees (pay_frequency) WHERE active;

CREATE TABLE payroll_periods (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  frequency        VARCHAR(10)   NOT NULL CHECK (frequency IN ('MONTHLY', 'BIWEEKLY')),
  period_start     DATE          NOT NULL,
  period_end       DATE          NOT NULL,
  pay_date         DATE          NOT NULL,
  status           VARCHAR(10)   NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'PAID')),
  total_gross      DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_net        DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by       BIGINT        NOT NULL REFERENCES users (id),
  approved_at      TIMESTAMPTZ,
  approved_by      BIGINT        REFERENCES users (id),
  paid_at          TIMESTAMPTZ,
  paid_by          BIGINT        REFERENCES users (id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT payroll_periods_unique UNIQUE (frequency, period_start),
  CONSTRAINT payroll_periods_range CHECK (period_end >= period_start),
  CONSTRAINT payroll_periods_approved CHECK ((status = 'DRAFT') = (approved_at IS NULL) AND (approved_at IS NULL) = (approved_by IS NULL)),
  CONSTRAINT payroll_periods_paid CHECK ((status = 'PAID') = (paid_at IS NOT NULL) AND (paid_at IS NULL) = (paid_by IS NULL))
);
-- Periodos sin pagar por fecha de pago: calendario y avisos (listUpcomingPayroll).
CREATE INDEX payroll_periods_unpaid_idx ON payroll_periods (pay_date) WHERE status <> 'PAID';

CREATE TABLE payroll_lines (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_id        BIGINT        NOT NULL REFERENCES payroll_periods (id) ON DELETE CASCADE,
  employee_id      BIGINT        NOT NULL REFERENCES payroll_employees (id),
  base             DECIMAL(12,2) NOT NULL CHECK (base >= 0),
  overtime         DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (overtime >= 0),
  bonuses          DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (bonuses >= 0),
  transport        DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (transport >= 0),
  health           DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (health >= 0),
  pension          DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pension >= 0),
  other_deductions DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (other_deductions >= 0),
  gross            DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions       DECIMAL(12,2) NOT NULL DEFAULT 0,
  net              DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (net >= 0),
  CONSTRAINT payroll_lines_unique UNIQUE (period_id, employee_id)
);
CREATE INDEX payroll_lines_employee_idx ON payroll_lines (employee_id);
