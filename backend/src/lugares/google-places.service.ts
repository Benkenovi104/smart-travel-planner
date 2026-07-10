import { Injectable, Logger } from '@nestjs/common';

export interface PoiGoogle {
  nombre: string;
  ciudad: string | null;
  pais: string | null;
  direccion: string | null;
  latitud: number;
  longitud: number;
  categoria: string;
  rating: number | null;
}

interface PlaceGoogle {
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
}

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK =
  'places.displayName,places.formattedAddress,places.location,places.rating';

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY!;

  /**
   * Busca lugares con Text Search (Places API New). No hace falta geocodificar
   * el destino por separado: Google resuelve la ubicación a partir del texto
   * de la consulta (ej: "museos en Mendoza, Argentina").
   */
  async buscarPorCategoria(
    categoria: string,
    terminoBusqueda: string,
    destino: string,
    limit = 6,
  ): Promise<PoiGoogle[]> {
    const res = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${terminoBusqueda} en ${destino}`,
        pageSize: limit,
        languageCode: 'es',
      }),
    });

    if (!res.ok) {
      this.logger.warn(
        `Búsqueda de "${terminoBusqueda} en ${destino}" falló: HTTP ${res.status}`,
      );
      return [];
    }

    const data = (await res.json()) as { places?: PlaceGoogle[] };

    // Normalizamos a solo el nombre de la ciudad (sin país/provincia) porque
    // es lo que Gemini también usa en el campo "ciudad" de cada actividad —
    // si no coinciden, el matching por nombre+ciudad para reusar el lugar
    // cacheado en itinerarios.service.ts nunca encuentra el registro.
    const ciudad = destino.split(',')[0].trim();

    return (data.places ?? [])
      .filter((p) => p.displayName && p.location)
      .map((p) => ({
        nombre: p.displayName!.text,
        ciudad,
        pais: p.formattedAddress?.split(',').pop()?.trim() ?? null,
        direccion: p.formattedAddress ?? null,
        latitud: p.location!.latitude,
        longitud: p.location!.longitude,
        categoria,
        rating: p.rating ?? null,
      }));
  }
}
