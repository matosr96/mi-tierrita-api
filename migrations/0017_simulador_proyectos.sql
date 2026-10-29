-- Qué cambia: tabla `financial_projects` con los proyectos guardados del simulador financiero por unidades
-- (Mercado, Competencia, Costos, Inversión, Financiación, Flujo de caja y Riesgos).
-- Por qué: la Fase B del brief pide «Guardar proyecto», «Guardar como», lista por usuario, abrir, comparar y exportar.
-- Solo se guardan los supuestos (`input`); las cifras las recalcula el motor `simulator.ts` en cada lectura, así la
-- pantalla, el informe y «Exportar escenario» muestran siempre el mismo cálculo (decisión 3). A diferencia de
-- `financial_scenarios` (modelo del capítulo 5, inmutable), un proyecto se puede sobrescribir: solo su dueño lo
-- edita o elimina. Módulo nuevo: no estaba en el documento 06 (queda registrado en el README).

CREATE TABLE financial_projects (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  user_id    BIGINT       NOT NULL REFERENCES users (id),
  input      JSONB        NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX financial_projects_user_id_idx ON financial_projects (user_id, updated_at DESC);
