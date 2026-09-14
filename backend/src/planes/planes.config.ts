import { Plan, TipoConsumo } from '../../generated/prisma/enums.js';

/**
 * Límites de cada plan (ver docs/PLANES.md). Es la **única** fuente de verdad: el
 * frontend los pide a `GET /planes` y nunca los tiene escritos, así que cambiar un
 * número acá alcanza.
 *
 * `null` = sin límite. `0` = no incluido en el plan.
 */
export interface LimitesPlan {
  /** Viajes que se pueden crear por período. El único límite que se reinicia. */
  viajesPorPeriodo: number | null;
  generarPorViaje: number | null;
  regenerarPorViaje: number | null;
  optimizar: boolean;
  alojamientoPorViaje: number | null;
  vuelosPorViaje: number | null;
}

export const LIMITES: Record<Plan, LimitesPlan> = {
  GRATIS: {
    viajesPorPeriodo: 1,
    generarPorViaje: 1,
    regenerarPorViaje: 0,
    optimizar: false,
    alojamientoPorViaje: 1,
    vuelosPorViaje: 0,
  },
  BASE: {
    viajesPorPeriodo: 5,
    generarPorViaje: null,
    regenerarPorViaje: 3,
    optimizar: true,
    alojamientoPorViaje: 3,
    vuelosPorViaje: 1,
  },
  PREMIUM: {
    viajesPorPeriodo: null,
    generarPorViaje: null,
    regenerarPorViaje: null,
    optimizar: true,
    alojamientoPorViaje: null,
    // No es "sin límite": la cuota de Sky Scrapper es de toda la app.
    vuelosPorViaje: 3,
  },
};

/** De menor a mayor. Define cuál es el plan siguiente a sugerir. */
export const ORDEN_PLANES: readonly Plan[] = [
  Plan.GRATIS,
  Plan.BASE,
  Plan.PREMIUM,
];

export const NOMBRE_PLAN: Record<Plan, string> = {
  GRATIS: 'Gratis',
  BASE: 'Base',
  PREMIUM: 'Premium',
};

/**
 * Precio mensual en pesos. Mercado Pago Argentina solo cobra suscripciones en ARS
 * (con `currency_id: 'USD'` responde "Invalid field -> auto_recurring.currency_id"),
 * así que los precios, pensados en dólares, se fijan en pesos: US$ 8 y US$ 25 al
 * dólar MEP del 14/09/2026 ($ 1.539,90), redondeados. Hay que revisarlos cada tanto
 * por la inflación: Mercado Pago permite actualizar el monto de las suscripciones
 * que ya existen.
 */
export const PRECIO_MENSUAL_ARS: Record<Plan, number> = {
  GRATIS: 0,
  BASE: 12_500,
  PREMIUM: 38_500,
};

/** Días que un plan pago sigue activo cuando el cobro de la renovación no llega. */
export const DIAS_DE_GRACIA = 3;

/**
 * Tope anti-abuso por usuario en las últimas 24 horas, igual para todos los
 * planes. No es un límite comercial: subir de plan no lo levanta.
 */
export const TOPE_DIARIO = {
  itinerario: 10,
  busquedas: 20,
} as const;

export const ACCIONES_ITINERARIO: readonly TipoConsumo[] = [
  TipoConsumo.GENERAR_ITINERARIO,
  TipoConsumo.REGENERAR_ITINERARIO,
];

/** Vuelos y alojamiento suman juntos para el tope diario. */
export const ACCIONES_BUSQUEDA: readonly TipoConsumo[] = [
  TipoConsumo.BUSCAR_VUELOS,
  TipoConsumo.BUSCAR_ALOJAMIENTO,
];
