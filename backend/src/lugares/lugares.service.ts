import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Lugar } from '../../generated/prisma/client.js';
import { GooglePlacesService } from './google-places.service.js';

// Clave interna -> término de búsqueda en español para Google Places Text Search.
export const CATEGORIAS_TURISTICAS: Record<string, string> = {
  museo: 'museos',
  atraccion_turistica: 'atracciones turísticas',
  sitio_historico: 'sitios históricos',
  monumento: 'monumentos',
  parque: 'parques',
  mirador: 'miradores',
  restaurante: 'restaurantes',
  cafe: 'cafés',
};

@Injectable()
export class LugaresService {
  private readonly logger = new Logger(LugaresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googlePlaces: GooglePlacesService,
  ) {}

  /**
   * Busca POIs reales (Google Places) para un destino y los cachea en la
   * tabla `lugares` (reutilizando el registro si ya existía por nombre+ciudad).
   */
  async buscarYCachear(
    destino: string,
    categorias: Record<string, string> = CATEGORIAS_TURISTICAS,
  ): Promise<Lugar[]> {
    const resultadosPorCategoria = await Promise.all(
      Object.entries(categorias).map(([categoria, termino]) =>
        this.googlePlaces.buscarPorCategoria(categoria, termino, destino),
      ),
    );

    const vistos = new Set<string>();
    const pois = resultadosPorCategoria.flat().filter((poi) => {
      const key = `${poi.nombre.toLowerCase()}|${(poi.ciudad ?? '').toLowerCase()}`;
      if (vistos.has(key)) return false;
      vistos.add(key);
      return true;
    });

    if (pois.length === 0) {
      this.logger.warn(`Sin resultados de lugares reales para "${destino}"`);
      return [];
    }

    const encontrados = await Promise.all(
      pois.map((poi) =>
        this.prisma.lugar.findFirst({
          where: {
            nombre: { equals: poi.nombre, mode: 'insensitive' },
            ...(poi.ciudad && {
              ciudad: { equals: poi.ciudad, mode: 'insensitive' },
            }),
          },
        }),
      ),
    );

    return Promise.all(
      pois.map(async (poi, i) => {
        const existente = encontrados[i];
        if (existente) return existente;

        return this.prisma.lugar.create({
          data: {
            nombre: poi.nombre,
            ciudad: poi.ciudad,
            pais: poi.pais,
            direccion: poi.direccion,
            latitud: poi.latitud,
            longitud: poi.longitud,
            categoria: poi.categoria,
            fuente_api: 'google_places',
          },
        });
      }),
    );
  }
}
