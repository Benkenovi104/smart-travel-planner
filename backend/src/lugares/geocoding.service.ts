import { Injectable, Logger } from '@nestjs/common';

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Nominatim exige un User-Agent identificatorio en su política de uso.
const USER_AGENT = 'SmartTravelPlanner/1.0 (proyecto academico)';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  /**
   * Geocodifica un lugar (nombre + ciudad + país) a coordenadas usando
   * Nominatim (OpenStreetMap). Gratis y sin API key. Devuelve null si no
   * encuentra nada o si la API falla (no bloquea el flujo que lo llama).
   */
  async geocodificar(
    nombre: string,
    ciudad?: string | null,
    pais?: string | null,
  ): Promise<Coordenadas | null> {
    const consulta = [nombre, ciudad, pais].filter(Boolean).join(', ');
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(consulta)}&format=json&limit=1`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) {
        this.logger.warn(`Nominatim respondió ${res.status} para "${consulta}"`);
        return null;
      }

      const data: unknown = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      const primero = data[0] as { lat?: string; lon?: string };
      const latitud = Number(primero.lat);
      const longitud = Number(primero.lon);
      if (Number.isNaN(latitud) || Number.isNaN(longitud)) return null;

      return { latitud, longitud };
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Geocoding falló para "${consulta}": ${mensaje}`);
      return null;
    }
  }
}
