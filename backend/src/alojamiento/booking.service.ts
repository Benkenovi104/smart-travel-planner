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

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly apiKey = process.env.RAPIDAPI_KEY!;

  private headers() {
    return { 'X-RapidAPI-Key': this.apiKey, 'X-RapidAPI-Host': HOST };
  }

  async resolverDestino(
    nombre: string,
  ): Promise<{ destId: string; searchType: string } | null> {
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
