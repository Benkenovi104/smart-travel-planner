/**
 * Decidir si un resultado de Google Places es el mismo hotel que uno de Booking.
 *
 * Hace falta porque las dos APIs nombran distinto a la misma propiedad
 * ("ibis budget Paris Porte de Bercy" vs "Ibis Budget Bercy"), y pegarle las
 * fotos del hotel equivocado a una tarjeta es peor que no mostrar foto.
 *
 * La señal fuerte son las coordenadas: si ambos las traen y están a menos de
 * `MAX_METROS`, es el mismo edificio. El nombre se usa como respaldo cuando
 * alguno de los dos no tiene coordenadas.
 */

/** Dos hoteles a esta distancia o menos se consideran el mismo edificio. */
const MAX_METROS = 300;

/**
 * Palabras que no distinguen un hotel de otro: aparecen en media ciudad y
 * generan coincidencias falsas ("Hotel Roma" vs "Hotel Madrid" comparten
 * "hotel" y nada más).
 */
const PALABRAS_GENERICAS = new Set([
  'hotel',
  'hostel',
  'hostal',
  'apart',
  'apartamento',
  'apartamentos',
  'departamento',
  'suites',
  'suite',
  'resort',
  'inn',
  'the',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'and',
  'by',
]);

/** Minúsculas, sin acentos ni puntuación, en palabras significativas. */
export function tokenizarNombre(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !PALABRAS_GENERICAS.has(t));
}

/** Distancia en metros entre dos puntos (fórmula del haversine). */
export function distanciaMetros(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Proporción de palabras significativas del nombre más corto que aparecen en el
 * otro. 1 = todas. Devuelve 0 si alguno queda sin palabras propias.
 */
export function similitudNombre(a: string, b: string): number {
  const ta = tokenizarNombre(a);
  const tb = tokenizarNombre(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const enLargo = new Set(largo);
  const comunes = corto.filter((t) => enLargo.has(t)).length;
  return comunes / corto.length;
}

export interface HotelParaComparar {
  nombre: string;
  latitud: number | null;
  longitud: number | null;
}

/**
 * ¿Son el mismo hotel? Con coordenadas de ambos lados decide por distancia; si
 * falta alguna, exige que los nombres compartan **todas** las palabras
 * significativas del más corto, que es un criterio deliberadamente estricto:
 * ante la duda preferimos una tarjeta sin foto antes que la foto equivocada.
 */
export function esElMismoHotel(
  a: HotelParaComparar,
  b: HotelParaComparar,
): boolean {
  const hayCoords =
    a.latitud != null &&
    a.longitud != null &&
    b.latitud != null &&
    b.longitud != null;

  if (hayCoords) {
    const metros = distanciaMetros(
      a.latitud!,
      a.longitud!,
      b.latitud!,
      b.longitud!,
    );
    if (metros <= MAX_METROS) return true;
    // Lejos pero con el mismo nombre exacto: puede ser que una de las dos APIs
    // tenga la coordenada mal puesta, cosa que pasa seguido en Booking.
    return similitudNombre(a.nombre, b.nombre) === 1;
  }

  return similitudNombre(a.nombre, b.nombre) === 1;
}
