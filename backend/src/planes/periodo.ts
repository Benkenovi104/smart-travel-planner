/**
 * El período de un plan dura un mes y se cuenta desde el día ancla (el del pago,
 * o el del registro en el plan Gratis), no desde el 1° del mes.
 *
 * Todo se calcula en UTC y a mano, a propósito: este proyecto ya tuvo tres bugs
 * por fechas interpretadas en la zona horaria del servidor. Consecuencia conocida:
 * un pago hecho en Argentina después de las 21 h cae en UTC en el día siguiente, y
 * ese es su día ancla.
 */

export interface Periodo {
  desde: Date;
  hasta: Date;
}

/**
 * La fecha ancla corrida `meses` meses, conservando día y hora. Si el mes destino
 * no tiene ese día, usa el último: ancla 31/01 → 28/02 → 31/03.
 *
 * Siempre se calcula desde el ancla original y nunca encadenando períodos: eso es
 * lo que hace que después de febrero se vuelva al 31.
 */
export function sumarMesesAnclado(ancla: Date, meses: number): Date {
  const anio = ancla.getUTCFullYear();
  const mes = ancla.getUTCMonth() + meses;
  // El día 0 del mes siguiente es el último del mes buscado. Date.UTC normaliza
  // solo los desbordes de mes y de año.
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      anio,
      mes,
      Math.min(ancla.getUTCDate(), ultimoDia),
      ancla.getUTCHours(),
      ancla.getUTCMinutes(),
      ancla.getUTCSeconds(),
      ancla.getUTCMilliseconds(),
    ),
  );
}

/** El período que contiene a `ahora`, con `desde <= ahora < hasta`. */
export function periodoVigente(ancla: Date, ahora: Date): Periodo {
  if (ahora.getTime() < ancla.getTime()) {
    return { desde: ancla, hasta: sumarMesesAnclado(ancla, 1) };
  }

  // Estimación por diferencia de meses de calendario y ajuste fino: el día y la
  // hora del ancla pueden hacer que todavía no se haya cumplido el mes.
  let n =
    (ahora.getUTCFullYear() - ancla.getUTCFullYear()) * 12 +
    (ahora.getUTCMonth() - ancla.getUTCMonth());
  while (n > 0 && sumarMesesAnclado(ancla, n).getTime() > ahora.getTime()) n--;
  while (sumarMesesAnclado(ancla, n + 1).getTime() <= ahora.getTime()) n++;

  return {
    desde: sumarMesesAnclado(ancla, n),
    hasta: sumarMesesAnclado(ancla, n + 1),
  };
}
