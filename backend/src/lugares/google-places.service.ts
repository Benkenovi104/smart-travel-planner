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

export interface HotelGoogle {
  id: string;
  nombre: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
  fotoUrl: string | null;
  fotos: string[];
  priceLevel: string | null;
}

const HOTEL_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.photos,places.priceLevel';

const PHOTO_MEDIA_BASE = 'https://places.googleapis.com/v1';

/**
 * Nombre de recurso de una foto de Places: `places/<id>/photos/<id>`. Se valida
 * antes de armar la URL a Google porque el nombre llega por query string desde
 * el browser y se interpola en el path del fetch.
 */
const FOTO_RESOURCE_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/**
 * Las fotos NO se sirven con la URL de Google directa: esa URL lleva la API key
 * como query param y terminaría en el HTML del browser, visible para cualquiera
 * que abra el inspector. Se guarda una ruta a nuestro propio backend y la key se
 * usa sólo server-side, en `descargarFoto()`.
 */
export function rutaFotoProxy(resourceName: string): string {
  return `/api/lugares/foto?name=${encodeURIComponent(resourceName)}`;
}

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

  /**
   * Busca alojamientos reales en un destino usando Google Places New Text Search.
   */
  async buscarAlojamientosGoogle(
    destino: string,
    limit = 8,
  ): Promise<HotelGoogle[]> {
    return this.buscarHotelesConQuery(
      `hoteles o alojamientos en ${destino}`,
      limit,
    );
  }

  /**
   * Text Search de alojamientos con el `textQuery` ya armado. Existe porque la
   * consulta cambia según el caso: para listar hoteles de una ciudad conviene
   * "hoteles o alojamientos en X", pero para encontrar UNO puntual ese prefijo
   * ensucia la búsqueda y Google devuelve cualquier otro lugar de la zona.
   */
  private async buscarHotelesConQuery(
    textQuery: string,
    limit: number,
    cerca?: { latitud: number; longitud: number },
  ): Promise<HotelGoogle[]> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY no configurada');
      return [];
    }

    try {
      const res = await fetch(TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': HOTEL_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery,
          includedType: 'lodging',
          pageSize: limit,
          languageCode: 'es',
          // Con coordenadas, Google acierta mucho más seguido: los nombres de
          // apart/departamentos son genéricos y sin sesgo devuelve vacío o
          // cualquier otra propiedad de la ciudad.
          ...(cerca
            ? {
                locationBias: {
                  circle: {
                    center: {
                      latitude: cerca.latitud,
                      longitude: cerca.longitud,
                    },
                    radius: 2000,
                  },
                },
              }
            : {}),
        }),
      });

      if (!res.ok) {
        this.logger.warn(
          `Búsqueda de alojamientos "${textQuery}" falló: HTTP ${res.status}`,
        );
        return [];
      }

      const data = (await res.json()) as {
        places?: Array<{
          id?: string;
          displayName?: { text: string };
          formattedAddress?: string;
          location?: { latitude: number; longitude: number };
          rating?: number;
          userRatingCount?: number;
          websiteUri?: string;
          googleMapsUri?: string;
          photos?: Array<{ name: string }>;
          priceLevel?: string;
        }>;
      };

      return (data.places ?? [])
        .filter((p) => p.displayName && p.location)
        .map((p) => {
          const fotos: string[] = (p.photos ?? [])
            .slice(0, 5)
            .filter((ph) => !!ph.name && FOTO_RESOURCE_RE.test(ph.name))
            .map((ph) => rutaFotoProxy(ph.name));

          const fotoUrl = fotos[0] ?? null;

          return {
            id: p.id ?? p.displayName!.text,
            nombre: p.displayName!.text,
            direccion: p.formattedAddress ?? null,
            latitud: p.location!.latitude,
            longitud: p.location!.longitude,
            rating: p.rating ?? null,
            userRatingCount: p.userRatingCount ?? null,
            websiteUri: p.websiteUri ?? null,
            googleMapsUri: p.googleMapsUri ?? null,
            fotoUrl,
            fotos,
            priceLevel: p.priceLevel ?? null,
          };
        });
    } catch (error) {
      this.logger.error(
        `Error buscando alojamientos ("${textQuery}"): ${error}`,
      );
      return [];
    }
  }

  /**
   * Busca UN hotel puntual por nombre para enriquecer un resultado de Booking
   * con fotos, sitio web y dirección. Es un problema mucho más fácil que cruzar
   * dos listas: acá ya sabemos qué hotel queremos, sólo hay que encontrarlo.
   *
   * Devuelve el candidato más relevante SIN verificar que sea el correcto: de
   * eso se encarga `esElMismoHotel` en el llamador, que tiene las coordenadas
   * de Booking para comparar.
   */
  async buscarDetalleHotel(
    nombre: string,
    ciudad: string,
    cerca?: { latitud: number; longitud: number },
  ): Promise<HotelGoogle | null> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY no configurada');
      return null;
    }

    // Sin el prefijo de "hoteles en...": acá buscamos una propiedad concreta.
    const hoteles = await this.buscarHotelesConQuery(
      `${nombre}, ${ciudad}`,
      1,
      cerca,
    );
    return hoteles[0] ?? null;
  }

  /**
   * Descarga una foto de Places server-side para no exponer la API key en el
   * browser (ver `rutaFotoProxy`). Devuelve `null` si el nombre no tiene la
   * forma esperada, si no hay key configurada o si Google rechaza el pedido.
   */
  async descargarFoto(
    resourceName: string,
    maxHeightPx = 600,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!FOTO_RESOURCE_RE.test(resourceName)) {
      this.logger.warn(`Nombre de foto inválido: "${resourceName}"`);
      return null;
    }
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY no configurada');
      return null;
    }

    try {
      const url = `${PHOTO_MEDIA_BASE}/${resourceName}/media?maxHeightPx=${maxHeightPx}`;
      const res = await fetch(url, {
        headers: { 'X-Goog-Api-Key': this.apiKey },
      });

      if (!res.ok) {
        this.logger.warn(`Foto ${resourceName} falló: HTTP ${res.status}`);
        return null;
      }

      return {
        buffer: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') ?? 'image/jpeg',
      };
    } catch (error) {
      this.logger.error(`Error al descargar la foto ${resourceName}: ${error}`);
      return null;
    }
  }
}
