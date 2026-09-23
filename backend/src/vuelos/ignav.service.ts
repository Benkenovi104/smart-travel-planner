import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

export interface VueloOpcion {
  origen: string;
  destino: string;
  fecha: string;
  /** Llegada del tramo. Puede caer al día siguiente en vuelos largos o nocturnos. */
  llegada: string | null;
  aerolinea: string | null;
  precio: number;
  /** Duración del tramo puerta a puerta: **incluye las escalas**, no es tiempo de vuelo. */
  duracionMinutos: number;
  escalas: number | null;
}

/** Lo que necesita Ignav para buscar: el IATA. La ciudad se guarda sólo para mostrar. */
export interface Aeropuerto {
  iata: string;
  ciudad: string;
}

interface IgnavAeropuerto {
  code: string;
  name: string;
  city: string;
  country: string;
}

interface IgnavSegmento {
  marketing_carrier_code: string | null;
  flight_number: string | null;
  operating_carrier_name: string | null;
  departure_airport: string;
  departure_time_local: string;
  arrival_airport: string;
  arrival_time_local: string;
  duration_minutes: number;
}

interface IgnavItinerario {
  price: { amount: number; currency: string; status: string };
  outbound: {
    carrier: string | null;
    duration_minutes: number;
    segments: IgnavSegmento[];
  };
  ignav_id: string;
}

const BASE_URL = 'https://ignav.com/api';

// Ignav no toma una moneda por parámetro: la define el `market` (el punto de
// venta). Usamos US/USD porque es lo que devolvía Sky Scrapper con
// `currency=USD`, y el resto de la app —presupuesto, alojamiento, los fixtures
// de acá abajo— asume dólares. Cambiar a market=AR devolvería pesos y habría
// que tocar todo eso a la vez.
const MARKET = 'US';

// Ignav acepta códigos de área metropolitana (BUE, LON, NYC...) y devuelve los
// vuelos de todos los aeropuertos de esa ciudad. Importa más de lo que parece:
// el lookup de "Buenos Aires" devuelve AEP (Aeroparque), y buscar sólo AEP se
// pierde **todos** los vuelos internacionales, que salen de Ezeiza. Cuando el
// aeropuerto que resolvió el buscador pertenece a un área metropolitana, se
// busca por el área. Ampliable: sólo hacen falta las ciudades con más de un
// aeropuerto, el resto ya funciona con su IATA propio.
const AREA_METROPOLITANA: Record<string, { iata: string; ciudad: string }> = {
  AEP: { iata: 'BUE', ciudad: 'Buenos Aires' },
  EZE: { iata: 'BUE', ciudad: 'Buenos Aires' },
  GRU: { iata: 'SAO', ciudad: 'São Paulo' },
  CGH: { iata: 'SAO', ciudad: 'São Paulo' },
  VCP: { iata: 'SAO', ciudad: 'São Paulo' },
  GIG: { iata: 'RIO', ciudad: 'Río de Janeiro' },
  SDU: { iata: 'RIO', ciudad: 'Río de Janeiro' },
  JFK: { iata: 'NYC', ciudad: 'Nueva York' },
  EWR: { iata: 'NYC', ciudad: 'Nueva York' },
  LGA: { iata: 'NYC', ciudad: 'Nueva York' },
  LHR: { iata: 'LON', ciudad: 'Londres' },
  LGW: { iata: 'LON', ciudad: 'Londres' },
  STN: { iata: 'LON', ciudad: 'Londres' },
  LTN: { iata: 'LON', ciudad: 'Londres' },
  CDG: { iata: 'PAR', ciudad: 'París' },
  ORY: { iata: 'PAR', ciudad: 'París' },
  BVA: { iata: 'PAR', ciudad: 'París' },
  MXP: { iata: 'MIL', ciudad: 'Milán' },
  LIN: { iata: 'MIL', ciudad: 'Milán' },
  BGY: { iata: 'MIL', ciudad: 'Milán' },
  FCO: { iata: 'ROM', ciudad: 'Roma' },
  CIA: { iata: 'ROM', ciudad: 'Roma' },
  ORD: { iata: 'CHI', ciudad: 'Chicago' },
  MDW: { iata: 'CHI', ciudad: 'Chicago' },
  IAD: { iata: 'WAS', ciudad: 'Washington' },
  DCA: { iata: 'WAS', ciudad: 'Washington' },
  BWI: { iata: 'WAS', ciudad: 'Washington' },
  NRT: { iata: 'TYO', ciudad: 'Tokio' },
  HND: { iata: 'TYO', ciudad: 'Tokio' },
};

// Datos fixture para el modo mock (IGNAV_MOCK=true): evita gastar requests
// reales. Basados en resultados reales de Buenos Aires <-> Mendoza.
const VUELOS_MOCK: {
  aerolinea: string;
  precio: number;
  duracionMinutos: number;
  escalas: number;
}[] = [
  { aerolinea: 'Flybondi', precio: 87, duracionMinutos: 105, escalas: 0 },
  { aerolinea: 'JetSmart', precio: 94, duracionMinutos: 110, escalas: 0 },
  {
    aerolinea: 'Aerolíneas Argentinas',
    precio: 132,
    duracionMinutos: 100,
    escalas: 0,
  },
  { aerolinea: 'Flybondi', precio: 145, duracionMinutos: 235, escalas: 1 },
  {
    aerolinea: 'Aerolíneas Argentinas',
    precio: 168,
    duracionMinutos: 95,
    escalas: 0,
  },
];

@Injectable()
export class IgnavService {
  private readonly logger = new Logger(IgnavService.name);
  private readonly apiKey = process.env.IGNAV_API_KEY!;

  /**
   * Los aeropuertos de un viaje se resuelven una vez por búsqueda y las ciudades
   * se repiten muchísimo entre viajes (todos salen de Buenos Aires). Cachear el
   * lookup en memoria ahorra la mitad de los requests sin ninguna contra: los
   * IATA de una ciudad no cambian.
   */
  private readonly cacheAeropuertos = new Map<string, Aeropuerto | null>();

  private get mock(): boolean {
    // IGNAV_MOCK es la que manda; se cae a RAPIDAPI_MOCK para no romper los
    // .env que ya existen, donde esa sola variable mockeaba vuelos y alojamiento.
    return (process.env.IGNAV_MOCK ?? process.env.RAPIDAPI_MOCK) === 'true';
  }

  private headers() {
    return { 'X-Api-Key': this.apiKey, 'Content-Type': 'application/json' };
  }

  /**
   * Ignav corta por facturación, no por cuota mensual como RapidAPI: 402 cuando
   * se agotaron los 1.000 requests gratis y todavía no hay tarjeta cargada, y
   * 429 cuando se tocó el tope de gasto que uno mismo configura en el panel.
   * Para el usuario final los dos significan lo mismo —no hay más búsquedas—
   * así que se traducen al mismo error que usaba `lanzarSiSinCuota`, que si no
   * el llamador sólo ve el `[]` con el que degradamos y le llega un "no se
   * encontraron vuelos" que manda a buscar el problema en el destino.
   */
  private lanzarSiSinCredito(res: Response): void {
    if (res.status !== 402 && res.status !== 429) return;

    throw new HttpException(
      'Se agotó el crédito de la API de vuelos. Volvé a intentar más adelante.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async resolverAeropuerto(nombre: string): Promise<Aeropuerto | null> {
    // El buscador degrada con strings tipo "Ciudad, País": el sufijo de país
    // ensucia el match. Nos quedamos sólo con la ciudad, igual que hace
    // google-places.service para el campo `ciudad`.
    const ciudad = nombre.split(',')[0].trim();

    if (this.mock) {
      this.logger.warn(`[MOCK] resolverAeropuerto("${nombre}") -> ${ciudad}`);
      return { iata: 'MCK', ciudad };
    }

    const cacheado = this.cacheAeropuertos.get(ciudad.toLowerCase());
    if (cacheado !== undefined) return cacheado;

    const url = new URL(`${BASE_URL}/airports`);
    url.searchParams.set('q', ciudad);
    url.searchParams.set('limit', '5');

    const res = await fetch(url, { headers: this.headers() });
    this.lanzarSiSinCredito(res);
    if (!res.ok) {
      this.logger.warn(`airports falló para "${nombre}": HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as IgnavAeropuerto[];
    const primero = data?.[0];
    if (!primero) {
      // Se cachea el null igual: si "Villa Gesell" no matchea hoy, no va a
      // matchear en el reintento del usuario, y cada intento cuesta plata.
      this.cacheAeropuertos.set(ciudad.toLowerCase(), null);
      return null;
    }

    const aeropuerto = AREA_METROPOLITANA[primero.code] ?? {
      iata: primero.code,
      ciudad: primero.city || ciudad,
    };
    this.cacheAeropuertos.set(ciudad.toLowerCase(), aeropuerto);
    return aeropuerto;
  }

  async buscarVuelos(params: {
    origen: Aeropuerto;
    destino: Aeropuerto;
    fecha: string;
    adultos: number;
  }): Promise<VueloOpcion[]> {
    if (this.mock) {
      this.logger.warn(
        `[MOCK] buscarVuelos ${params.origen.ciudad} -> ${params.destino.ciudad} (${VUELOS_MOCK.length} opciones fixture)`,
      );
      return VUELOS_MOCK.map((v) => ({
        origen: params.origen.ciudad,
        destino: params.destino.ciudad,
        fecha: `${params.fecha}T08:00:00`,
        llegada: new Date(
          new Date(`${params.fecha}T08:00:00Z`).getTime() +
            v.duracionMinutos * 60_000,
        )
          .toISOString()
          .replace('Z', ''),
        aerolinea: v.aerolinea,
        precio: v.precio,
        duracionMinutos: v.duracionMinutos,
        escalas: v.escalas,
      }));
    }

    const body = JSON.stringify({
      origin: params.origen.iata,
      destination: params.destino.iata,
      departure_date: params.fecha,
      adults: params.adultos,
      market: MARKET,
    });

    // 424 (`unable_to_complete_request`) es la falla del proveedor de arriba de
    // Ignav, y suele ser transitoria. Se reintenta igual que se reintentaba la
    // búsqueda asíncrona de Sky Scrapper; el resto de los errores no mejoran
    // reintentando, así que cortan de una.
    const INTENTOS = 3;
    for (let intento = 1; intento <= INTENTOS; intento++) {
      const res = await fetch(`${BASE_URL}/fares/one-way`, {
        method: 'POST',
        headers: this.headers(),
        body,
      });
      this.lanzarSiSinCredito(res);

      if (res.status === 424 && intento < INTENTOS) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      if (!res.ok) {
        this.logger.warn(
          `one-way falló (${params.origen.iata} -> ${params.destino.iata}): HTTP ${res.status}`,
        );
        return [];
      }

      const data = (await res.json()) as { itineraries?: IgnavItinerario[] };
      const itinerarios = data.itineraries ?? [];

      return itinerarios.map((it) => {
        const segmentos = it.outbound.segments ?? [];
        const primero = segmentos[0];
        const ultimo = segmentos[segmentos.length - 1];

        return {
          origen: params.origen.ciudad,
          destino: params.destino.ciudad,
          // Sin segmentos no hay horario real; se cae al mediodía de la fecha
          // pedida para no persistir una fecha inválida.
          fecha: primero?.departure_time_local ?? `${params.fecha}T12:00:00`,
          llegada: ultimo?.arrival_time_local ?? null,
          aerolinea: it.outbound.carrier,
          precio: it.price.amount,
          duracionMinutos: it.outbound.duration_minutes,
          // Ignav no manda un contador de escalas: son los segmentos menos uno.
          escalas: segmentos.length > 0 ? segmentos.length - 1 : null,
        };
      });
    }

    return [];
  }
}
