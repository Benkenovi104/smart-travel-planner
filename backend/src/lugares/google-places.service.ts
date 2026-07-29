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

export interface CiudadSugerida {
  id: string;
  descripcion: string;
  ciudad: string;
  pais: string | null;
}

interface PlaceGoogle {
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
}

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const FIELD_MASK =
  'places.displayName,places.formattedAddress,places.location,places.rating';

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY!;

  /**
   * Sugiere ciudades para Origen y Destino mediante Google Places New Autocomplete API.
   */
  async autocompleteCiudades(input: string): Promise<CiudadSugerida[]> {
    if (!input || input.trim().length < 2) return [];
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY no configurada');
      return [];
    }

    try {
      const res = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          input,
          includedPrimaryTypes: ['(cities)'],
          languageCode: 'es',
        }),
      });

      if (!res.ok) {
        this.logger.warn(
          `Autocomplete de "${input}" falló: HTTP ${res.status}`,
        );
        return [];
      }

      const data = (await res.json()) as {
        suggestions?: Array<{
          placePrediction?: {
            placeId?: string;
            text?: { text: string };
            structuredFormat?: {
              mainText?: { text: string };
              secondaryText?: { text: string };
            };
          };
        }>;
      };

      return (data.suggestions ?? [])
        .filter((s) => s.placePrediction?.text?.text)
        .map((s) => {
          const p = s.placePrediction!;
          const descripcion = p.text!.text;
          const mainText =
            p.structuredFormat?.mainText?.text ??
            descripcion.split(',')[0].trim();
          const secondaryText = p.structuredFormat?.secondaryText?.text;
          const pais = secondaryText
            ? (secondaryText.split(',').pop()?.trim() ?? null)
            : null;

          return {
            id: p.placeId ?? descripcion,
            descripcion,
            ciudad: mainText,
            pais,
          };
        });
    } catch (error) {
      this.logger.error(`Error en autocompleteCiudades: ${error}`);
      return [];
    }
  }

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
