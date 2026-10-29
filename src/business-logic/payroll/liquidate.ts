import type { PayFrequency } from "../../models/index";

/**
 * Liquidación simplificada de una línea de nómina. Función pura: no toca la base y se prueba sin servidor.
 *
 * Devengado  = salario base del periodo + horas extra/recargos + bonificaciones + auxilio de transporte.
 * Deducciones = salud (4 %) + pensión (4 %) sobre salario base + horas extra, + otros descuentos.
 * Neto       = devengado − deducciones.
 *
 * Fuera de alcance (pendiente, ver README): nómina electrónica de la DIAN, prestaciones sociales (prima, cesantías,
 * intereses, vacaciones), aportes del empleador, Fondo de Solidaridad Pensional y retención en la fuente. Ningún valor
 * legal que cambie cada año vive aquí: el auxilio de transporte lo escribe la persona con el valor del decreto vigente,
 * y no cotiza a salud ni pensión. Las bonificaciones se tratan como pagos no salariales (no cotizan).
 */

/** Aporte a salud a cargo del trabajador: 4 % del ingreso base de cotización (Ley 100 de 1993, art. 204, modificado por la Ley 1122 de 2007). */
export const HEALTH_EMPLOYEE_PERCENT = 4;
/** Aporte a pensión a cargo del trabajador: 4 % de la cotización del 16 % (Ley 100 de 1993, art. 20, modificado por la Ley 797 de 2003). */
export const PENSION_EMPLOYEE_PERCENT = 4;

/** Pesos enteros: la nómina se liquida y se paga sin centavos. */
export const roundPesos = (value: number): number => Math.round(value);

/** Porcentaje entero sobre pesos enteros: `pesos × % / 100` redondeado (el producto es exacto, no hay decimales de punto flotante). */
const percentOf = (pesos: number, percent: number): number => roundPesos((pesos * percent) / 100);

/** Salario base del periodo a partir del mensual pactado: mensual completo o la mitad en quincena. */
export const prorateBase = (monthly: number, frequency: PayFrequency): number =>
  frequency === "BIWEEKLY" ? roundPesos(monthly / 2) : roundPesos(monthly);

export type LineInput = { base: number; overtime: number; bonuses: number; transport: number; otherDeductions: number };
export type LineResult = { health: number; pension: number; gross: number; deductions: number; net: number };

export const liquidateLine = (input: LineInput): LineResult => {
  const base = roundPesos(input.base);
  const overtime = roundPesos(input.overtime);
  const bonuses = roundPesos(input.bonuses);
  const transport = roundPesos(input.transport);
  const otherDeductions = roundPesos(input.otherDeductions);
  // Ingreso base de cotización simplificado: salario del periodo + horas extra y recargos.
  const contributionBase = base + overtime;
  const health = percentOf(contributionBase, HEALTH_EMPLOYEE_PERCENT);
  const pension = percentOf(contributionBase, PENSION_EMPLOYEE_PERCENT);
  const gross = base + overtime + bonuses + transport;
  const deductions = health + pension + otherDeductions;
  return { health, pension, gross, deductions, net: gross - deductions };
};
