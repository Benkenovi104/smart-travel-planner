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

// Datos fixture para el modo mock (RAPIDAPI_MOCK=true). precioTotal es el total
// de la estadía (AlojamientoService lo divide por noches). Incluye un rating 10
// a propósito, para seguir ejercitando la columna rating Decimal(4,2).
const HOTELES_MOCK: {
  nombre: string;
  precioTotal: number;
  rating: number | null;
  latitud: number | null;
  longitud: number | null;
}[] = [
  { nombre: 'Apartamento Aristides', precioTotal: 48.6, rating: 6, latitud: -32.8925, longitud: -68.854 },
  { nombre: 'Mendoza Capital Ciudad', precioTotal: 50, rating: 8.3, latitud: -32.8873, longitud: -68.8379 },
  { nombre: 'Departamento en el centro', precioTotal: 58, rating: 10, latitud: -32.8931, longitud: -68.839 },
  { nombre: 'Punto Apart Lamadrid', precioTotal: 61.2, rating: 9.6, latitud: -32.898, longitud: -68.8549 },
  { nombre: 'Millennium Inn Mendoza', precioTotal: 67.1, rating: 8.3, latitud: -32.8935, longitud: -68.8453 },
  { nombre: 'Park Hyatt Mendoza', precioTotal: 467.5, rating: 8.9, latitud: -32.889, longitud: -68.8458 },
];

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
      this.logger.warn(`[MOCK] resolverDestino("${nombre}")`);
      return { destId: 'MOCK', searchType: 'city' };
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
      this.logger.warn(
        `[MOCK] buscarHoteles (${HOTELES_MOCK.length} hoteles fixture)`,
      );
      return HOTELES_MOCK.map((h) => ({ ...h }));
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
