import { Injectable, Logger } from '@nestjs/common';

export interface HotelOpcion {
  nombre: string;
  precioTotal: number;
  rating: number | null;
  latitud: number | null;
  longitud: number | null;
}

interface DestinationResult {
  dest_id: string;
  search_type: string;
}

interface HotelResult {
  property: {
    name: string;
    reviewScore?: number;
    latitude?: number;
    longitude?: number;
    priceBreakdown?: { grossPrice?: { value: number } };
  };
}

const BASE_URL = 'https://booking-com15.p.rapidapi.com/api/v1/hotels';
const HOST = 'booking-com15.p.rapidapi.com';

/**
 * Datos fixture para el modo mock (RAPIDAPI_MOCK=true), por ciudad. `precioTotal`
 * es el total de la estadía (AlojamientoService lo divide por noches). Cada set
 * incluye un rating 10 a propósito, para seguir ejercitando la columna rating
 * Decimal(4,2).
 *
 * Las coordenadas son aproximadas (centro de la ciudad / zona del hotel): alcanzan
 * para ver el pin en el mapa, no son un dato de producción.
 */
const HOTELES_MOCK: Record<string, HotelOpcion[]> = {
  mendoza: [
    { nombre: 'Apartamento Aristides', precioTotal: 48.6, rating: 6, latitud: -32.8925, longitud: -68.854 },
    { nombre: 'Mendoza Capital Ciudad', precioTotal: 50, rating: 8.3, latitud: -32.8873, longitud: -68.8379 },
    { nombre: 'Departamento en el centro', precioTotal: 58, rating: 10, latitud: -32.8931, longitud: -68.839 },
    { nombre: 'Punto Apart Lamadrid', precioTotal: 61.2, rating: 9.6, latitud: -32.898, longitud: -68.8549 },
    { nombre: 'Millennium Inn Mendoza', precioTotal: 67.1, rating: 8.3, latitud: -32.8935, longitud: -68.8453 },
    { nombre: 'Park Hyatt Mendoza', precioTotal: 467.5, rating: 8.9, latitud: -32.889, longitud: -68.8458 },
  ],
  cordoba: [
    { nombre: 'Hotel Yrigoyen 111', precioTotal: 45, rating: 7.9, latitud: -31.4222, longitud: -64.1866 },
    { nombre: 'Ducal Suites', precioTotal: 52.5, rating: 8.1, latitud: -31.4166, longitud: -64.1852 },
    { nombre: 'Azur Real Hotel Boutique', precioTotal: 68, rating: 10, latitud: -31.4197, longitud: -64.1852 },
    { nombre: 'Windsor Hotel & Tower', precioTotal: 74.4, rating: 8.6, latitud: -31.4213, longitud: -64.1857 },
    { nombre: 'NH Córdoba Panorama', precioTotal: 89.9, rating: 8.4, latitud: -31.4172, longitud: -64.1847 },
    { nombre: 'Sheraton Córdoba Hotel', precioTotal: 132, rating: 8.8, latitud: -31.4177, longitud: -64.2 },
  ],
};

const CIUDAD_MOCK_DEFAULT = 'mendoza';

/** "Córdoba, Argentina" -> "cordoba". Para elegir el fixture del modo mock. */
function slugCiudad(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(',')[0]
    .trim();
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly apiKey = process.env.RAPIDAPI_KEY!;

  private get mock(): boolean {
    return process.env.RAPIDAPI_MOCK === 'true';
  }

  private headers() {
    return { 'X-RapidAPI-Key': this.apiKey, 'X-RapidAPI-Host': HOST };
  }

  async resolverDestino(
    nombre: string,
  ): Promise<{ destId: string; searchType: string } | null> {
    if (this.mock) {
      // El destino se codifica en el destId para que `buscarHoteles` sepa qué
      // fixture devolver (si no, los hoteles caen siempre en la misma ciudad).
      const ciudad = slugCiudad(nombre);
      this.logger.warn(`[MOCK] resolverDestino("${nombre}") -> ${ciudad}`);
      return { destId: `MOCK:${ciudad}`, searchType: 'city' };
    }

    const url = new URL(`${BASE_URL}/searchDestination`);
    url.searchParams.set('query', nombre);

    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      this.logger.warn(
        `searchDestination falló para "${nombre}": HTTP ${res.status}`,
      );
      return null;
    }

    const data = (await res.json()) as { data?: DestinationResult[] };
    const primero =
      data.data?.find((d) => d.search_type === 'city') ?? data.data?.[0];
    if (!primero) return null;

    return { destId: primero.dest_id, searchType: primero.search_type };
  }

  async buscarHoteles(params: {
    destino: { destId: string; searchType: string };
    fechaEntrada: string;
    fechaSalida: string;
    adultos: number;
  }): Promise<HotelOpcion[]> {
    if (this.mock) {
      const ciudad = params.destino.destId.replace(/^MOCK:/, '');
      const hoteles = HOTELES_MOCK[ciudad];
      if (!hoteles) {
        this.logger.warn(
          `[MOCK] no hay hoteles fixture para "${ciudad}", uso ${CIUDAD_MOCK_DEFAULT} (las coordenadas no van a coincidir con el destino)`,
        );
      }
      const elegidos = hoteles ?? HOTELES_MOCK[CIUDAD_MOCK_DEFAULT];
      this.logger.warn(
        `[MOCK] buscarHoteles(${ciudad}) -> ${elegidos.length} hoteles fixture`,
      );
      return elegidos.map((h) => ({ ...h }));
    }

    const url = new URL(`${BASE_URL}/searchHotels`);
    url.searchParams.set('dest_id', params.destino.destId);
    url.searchParams.set('search_type', params.destino.searchType);
    url.searchParams.set('arrival_date', params.fechaEntrada);
    url.searchParams.set('departure_date', params.fechaSalida);
    url.searchParams.set('adults', String(params.adultos));
    url.searchParams.set('room_qty', '1');
    url.searchParams.set('currency_code', 'USD');
    url.searchParams.set('languagecode', 'es');

    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) {
      this.logger.warn(
        `searchHotels falló (dest_id=${params.destino.destId}): HTTP ${res.status}`,
      );
      return [];
    }

    const data = (await res.json()) as { data?: { hotels?: HotelResult[] } };

    return (data.data?.hotels ?? [])
      .filter((h) => h.property.priceBreakdown?.grossPrice?.value !== undefined)
      .map((h) => ({
        nombre: h.property.name,
        precioTotal: h.property.priceBreakdown!.grossPrice!.value,
        rating: h.property.reviewScore ?? null,
        latitud: h.property.latitude ?? null,
        longitud: h.property.longitude ?? null,
      }));
  }
}
