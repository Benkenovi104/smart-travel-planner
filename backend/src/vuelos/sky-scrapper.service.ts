import { Injectable, Logger } from '@nestjs/common';
import { lanzarSiSinCuota } from '../common/rapidapi-cuota.js';

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

interface AirportResult {
  navigation: {
    relevantFlightParams: { skyId: string; entityId: string };
  };
}

interface FlightLeg {
  origin: { city?: string; name: string };
  destination: { city?: string; name: string };
  departure: string;
  arrival?: string;
  durationInMinutes: number;
  stopCount?: number;
  carriers: { marketing?: { name: string }[] };
}

interface FlightItinerary {
  price: { raw: number };
  legs: FlightLeg[];
}

const BASE_URL = 'https://sky-scrapper.p.rapidapi.com/api/v1/flights';
const HOST = 'sky-scrapper.p.rapidapi.com';

// Datos fixture para el modo mock (RAPIDAPI_MOCK=true): evita quemar cuota del
// free tier de RapidAPI. Basados en resultados reales de Buenos Aires <-> Mendoza.
const VUELOS_MOCK: {
  aerolinea: string;
  precio: number;
  duracionMinutos: number;
  escalas: number;
}[] = [
  { aerolinea: 'Flybondi', precio: 87, duracionMinutos: 105, escalas: 0 },
  { aerolinea: 'JetSmart', precio: 94, duracionMinutos: 110, escalas: 0 },
  { aerolinea: 'Aerolíneas Argentinas', precio: 132, duracionMinutos: 100, escalas: 0 },
  { aerolinea: 'Flybondi', precio: 145, duracionMinutos: 235, escalas: 1 },
  { aerolinea: 'Aerolíneas Argentinas', precio: 168, duracionMinutos: 95, escalas: 0 },
];

@Injectable()
export class SkyScrapperService {
  private readonly logger = new Logger(SkyScrapperService.name);
  private readonly apiKey = process.env.RAPIDAPI_KEY!;

  private get mock(): boolean {
    return process.env.RAPIDAPI_MOCK === 'true';
  }

  private headers() {
    return { 'X-RapidAPI-Key': this.apiKey, 'X-RapidAPI-Host': HOST };
  }

  async resolverAeropuerto(
    nombre: string,
  ): Promise<{ skyId: string; entityId: string } | null> {
    // searchAirport degrada con strings tipo "Ciudad, País": el sufijo de país
    // hace que matchee el aeropuerto principal del país en vez del de la ciudad
    // (ej: "Mendoza, Argentina" -> Buenos Aires). Nos quedamos solo con la
    // ciudad, igual que hace google-places.service para el campo `ciudad`.
    const ciudad = nombre.split(',')[0].trim();

    // En modo mock devolvemos la ciudad como skyId (buscarVuelos la usa como
    // origen/destino legible) sin pegarle a la API.
    if (this.mock) {
      this.logger.warn(`[MOCK] resolverAeropuerto("${nombre}") -> ${ciudad}`);
      return { skyId: ciudad, entityId: 'MOCK' };
    }

    const url = new URL(`${BASE_URL}/searchAirport`);
    url.searchParams.set('query', ciudad);

    const res = await fetch(url, { headers: this.headers() });
    lanzarSiSinCuota(res, 'vuelos');
    if (!res.ok) {
      this.logger.warn(
        `searchAirport falló para "${nombre}": HTTP ${res.status}`,
      );
      return null;
    }

    const data = (await res.json()) as { data?: AirportResult[] };
    const primero = data.data?.[0];
    if (!primero) return null;

    return {
      skyId: primero.navigation.relevantFlightParams.skyId,
      entityId: primero.navigation.relevantFlightParams.entityId,
    };
  }

  async buscarVuelos(params: {
    origen: { skyId: string; entityId: string };
    destino: { skyId: string; entityId: string };
    fecha: string;
    adultos: number;
  }): Promise<VueloOpcion[]> {
    if (this.mock) {
      this.logger.warn(
        `[MOCK] buscarVuelos ${params.origen.skyId} -> ${params.destino.skyId} (${VUELOS_MOCK.length} opciones fixture)`,
      );
      return VUELOS_MOCK.map((v) => ({
        origen: params.origen.skyId,
        destino: params.destino.skyId,
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

    const url = new URL(`${BASE_URL}/searchFlights`);
    url.searchParams.set('originSkyId', params.origen.skyId);
    url.searchParams.set('destinationSkyId', params.destino.skyId);
    url.searchParams.set('originEntityId', params.origen.entityId);
    url.searchParams.set('destinationEntityId', params.destino.entityId);
    url.searchParams.set('date', params.fecha);
    url.searchParams.set('adults', String(params.adultos));
    url.searchParams.set('currency', 'USD');

    // La búsqueda es asíncrona del lado de Sky Scrapper: la primera respuesta
    // puede venir con status "incomplete" y sin itinerarios todavía. Reintenta
    // un par de veces antes de devolver vacío.
    const INTENTOS = 3;
    for (let intento = 1; intento <= INTENTOS; intento++) {
      const res = await fetch(url, { headers: this.headers() });
      lanzarSiSinCuota(res, 'vuelos');
      if (!res.ok) {
        this.logger.warn(
          `searchFlights falló (${params.origen.skyId} -> ${params.destino.skyId}): HTTP ${res.status}`,
        );
        return [];
      }

      const data = (await res.json()) as {
        data?: { itineraries?: FlightItinerary[] };
      };
      const itinerarios = data.data?.itineraries ?? [];

      if (itinerarios.length > 0 || intento === INTENTOS) {
        return itinerarios.map((it) => {
          const leg = it.legs[0];
          return {
            origen: leg.origin.city ?? leg.origin.name,
            destino: leg.destination.city ?? leg.destination.name,
            fecha: leg.departure,
            llegada: leg.arrival ?? null,
            aerolinea: leg.carriers.marketing?.[0]?.name ?? null,
            precio: it.price.raw,
            duracionMinutos: leg.durationInMinutes,
            escalas: leg.stopCount ?? null,
          };
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return [];
  }
}
