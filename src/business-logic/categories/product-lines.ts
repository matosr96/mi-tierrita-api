/**
 * Las seis líneas de producto de la tienda, tal como las anuncia la página pública (catálogo v4.1).
 *
 * Son el contenido INICIAL: la migración 0018 las escribe en `categories` (código, descripción y subfamilias) y la
 * semilla las crea donde falten. La fuente de verdad en ejecución es la tabla `categories`: la landing las lee por
 * `GET /categories/public` y el administrador puede renombrarlas o desactivarlas. Una línea pública nueva necesita
 * además foto y escena en la app, así que se agrega aquí por desarrollo, no desde la interfaz.
 */
export type ProductLine = { code: string; name: string; description: string; tags: string[] };

export const PRODUCT_LINES: readonly ProductLine[] = [
  { code: "01", name: "Alimentos balanceados", description: "Concentrados para ganado, cerdos, aves y mascotas.", tags: ["Ganado", "Cerdos", "Aves", "Mascotas"] },
  { code: "02", name: "Medicina veterinaria", description: "Vacunas, desparasitantes y vitaminas, con control de lote y vencimiento.", tags: ["Vacunas", "Desparasitantes", "Vitaminas"] },
  { code: "03", name: "Semillas y fertilizantes", description: "Maíz, pastos y abonos para cada temporada.", tags: ["Maíz", "Pastos", "Abonos"] },
  { code: "04", name: "Aves de corral", description: "Pollitas ponedoras y pollos de engorde.", tags: ["Ponedoras", "Engorde"] },
  { code: "05", name: "Productos agroquímicos", description: "Herbicidas, insecticidas y fungicidas de uso agrícola.", tags: ["Herbicidas", "Insecticidas", "Fungicidas"] },
  { code: "06", name: "Ferretería agrícola", description: "Machetes, alambre, mangueras y herramienta de finca.", tags: ["Machetes", "Alambre", "Mangueras"] },
];
