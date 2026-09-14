import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingService, habitacionesPara } from './booking.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';
import { GooglePlacesService } from '../lugares/google-places.service.js';
import { GeminiService } from '../itinerarios/gemini.service.js';
import { esElMismoHotel } from './coincidencia.js';

const MAX_OPCIONES = 5;

/**
 * Cuántos hoteles de Booking se le pasan a la IA para que elija. Es más que
 * MAX_OPCIONES a propósito: rankear sobre pocos candidatos no aporta nada.
 */
const MAX_CANDIDATOS = 10;

type OpcionAlojamientoNueva = {
  id_viaje: number;
  nombre: string;
  tipo?: string;
  direccion?: string | null;
  precio_por_noche: number | null;
  rating?: number | null;
  latitud?: number | null;
  longitud?: number | null;
  url_referencia?: string | null;
};

/** Lo que guardamos en `url_referencia`, que hace de bolsa de metadata. */
interface MetadataAlojamiento {
  url: string | null;
  fotoUrl: string | null;
  fotos: string[];
  /** Justificación de la IA. `null` si no calificó este hotel. */
  razon: string | null;
  recomendadaIA: boolean;
  /** `true` sólo si `precio_por_noche` es una tarifa real, no una banda ni un invento. */
  precioReal: boolean;
  fuentePrecio: 'booking' | null;
  /** Banda de precio de Google (PRICE_LEVEL_*). Para hoteles casi nunca viene. */
  nivelPrecio: string | null;
}

@Injectable()
export class AlojamientoService {
  private readonly logger = new Logger(AlojamientoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingService,
    private readonly presupuestos: PresupuestosService,
    private readonly googlePlaces: GooglePlacesService,
    private readonly gemini: GeminiService,
  ) {}

  async buscarYGuardar(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const perfil = await this.prisma.perfilViajero.findUnique({
      where: { id_usuario },
    });

    const noches = Math.max(
      1,
      Math.round(
        (viaje.fechaFin.getTime() - viaje.fechaInicio.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    const contexto = {
      destino: viaje.destino_principal,
      presupuestoTotal: viaje.presupuestoTotal
        ? Number(viaje.presupuestoTotal)
        : undefined,
      cantidadPersonas: viaje.cantidadPersonas ?? 1,
      ritmoPreferido: perfil?.ritmoPreferido,
      presupuestoPreferido: perfil?.presupuesto_preferido,
      noches,
    };

    // Booking primero: es la única de las dos fuentes que da **tarifas reales
    // y disponibilidad para las fechas del viaje**. Google Places no publica
    // precios de hotel (verificado contra la API: ni `priceLevel` ni
    // `priceRange` vienen para `lodging`), pero sí tiene fotos, web y
    // dirección, así que se usa para enriquecer cada hotel de Booking.
    let opciones = await this.desdeBooking(viaje, id_viaje, noches, contexto);

    // Sin resultados de Booking (destino que no cubre, o sin disponibilidad)
    // caemos a Places solo: fichas completas, pero sin precio.
    if (opciones.length === 0) {
      this.logger.warn(
        `Booking no devolvió alojamiento para "${viaje.destino_principal}"; usando sólo Google Places (sin precios)`,
      );
      opciones = await this.desdeGooglePlaces(id_viaje, contexto);
    }

    if (opciones.length === 0) {
      throw new BadRequestException(
        'No se pudieron encontrar opciones de alojamiento para este viaje.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Reemplazar las opciones descarta la que estuviera seleccionada, así que
      // el presupuesto tiene que volver a calcularse sin ese alojamiento.
      await tx.opcionAlojamiento.deleteMany({ where: { id_viaje } });
      if (opciones.length > 0) {
        await tx.opcionAlojamiento.createMany({ data: opciones });
      }
      await this.presupuestos.recalcularConTx(tx, id_viaje);
    });

    return this.listar(id_usuario, id_viaje);
  }

  /**
   * Camino principal: hoteles reales de Booking (con precio y disponibilidad),
   * rankeados por la IA y enriquecidos con fotos y sitio web de Google Places.
   */
  private async desdeBooking(
    viaje: {
      destino_principal: string;
      fechaInicio: Date;
      fechaFin: Date;
      cantidadPersonas: number | null;
    },
    id_viaje: number,
    noches: number,
    contexto: Parameters<
      GeminiService['sugerirAlojamientos']
    >[0] extends infer T
      ? Omit<T, 'hotelesDisponibles'>
      : never,
  ): Promise<OpcionAlojamientoNueva[]> {
    const destino = await this.booking.resolverDestino(viaje.destino_principal);
    if (!destino) return [];

    const personas = viaje.cantidadPersonas ?? 1;
    const hoteles = await this.booking.buscarHoteles({
      destino,
      fechaEntrada: viaje.fechaInicio.toISOString().split('T')[0],
      fechaSalida: viaje.fechaFin.toISOString().split('T')[0],
      adultos: personas,
      habitaciones: habitacionesPara(personas),
    });
    if (hoteles.length === 0) return [];

    // `precioTotal` es la estadía completa para todo el grupo, así que dividir
    // por noches ya deja el precio por noche prorrateado: NO se multiplica por
    // cantidad de personas.
    const candidatos = hoteles
      .map((h, i) => ({
        ...h,
        id: String(i),
        precioPorNoche: h.precioTotal / noches,
      }))
      .sort((a, b) => a.precioPorNoche - b.precioPorNoche)
      .slice(0, MAX_CANDIDATOS);

    const recomendaciones = await this.gemini.sugerirAlojamientos({
      ...contexto,
      hotelesDisponibles: candidatos.map((h) => ({
        id: h.id,
        nombre: h.nombre,
        direccion: null,
        rating: h.rating,
        userRatingCount: null,
        precioPorNoche: h.precioPorNoche,
      })),
    });
    const porId = new Map(recomendaciones.map((r) => [r.id, r]));

    // Primero los que la IA eligió, en su orden; después el resto por precio
    // ascendente, que es el criterio de ajuste al presupuesto.
    const recomendados = recomendaciones
      .map((r) => candidatos.find((h) => h.id === r.id))
      .filter((h): h is (typeof candidatos)[number] => h !== undefined);
    const resto = candidatos.filter((h) => !porId.has(h.id));
    const elegidos = [...recomendados, ...resto].slice(0, MAX_OPCIONES);

    // Una consulta a Places por hotel, sólo para los que vamos a mostrar.
    const fichas = await Promise.all(
      elegidos.map((h) =>
        this.googlePlaces
          .buscarDetalleHotel(
            h.nombre,
            viaje.destino_principal,
            h.latitud != null && h.longitud != null
              ? { latitud: h.latitud, longitud: h.longitud }
              : undefined,
          )
          .catch(() => null),
      ),
    );

    return elegidos.map((h, i) => {
      const ficha = fichas[i];
      // Sólo usamos la ficha si es verdaderamente el mismo hotel: pegarle las
      // fotos del hotel de al lado es peor que no mostrar ninguna.
      const coincide =
        ficha != null &&
        esElMismoHotel(
          { nombre: h.nombre, latitud: h.latitud, longitud: h.longitud },
          {
            nombre: ficha.nombre,
            latitud: ficha.latitud,
            longitud: ficha.longitud,
          },
        );
      const rec = porId.get(h.id);
      if (ficha && !coincide) {
        this.logger.log(
          `"${h.nombre}" (Booking) y "${ficha.nombre}" (Places) no parecen el mismo hotel: se muestra sin foto`,
        );
      }

      const metadata: MetadataAlojamiento = {
        url: coincide ? (ficha.websiteUri ?? ficha.googleMapsUri) : null,
        fotoUrl: coincide ? ficha.fotoUrl : null,
        fotos: coincide ? ficha.fotos : [],
        razon: rec?.razonRecomendacion ?? null,
        recomendadaIA: !!rec,
        precioReal: true,
        fuentePrecio: 'booking',
        nivelPrecio: null,
      };

      return {
        id_viaje,
        nombre: h.nombre,
        tipo: 'Hotel',
        direccion: coincide ? ficha.direccion : null,
        precio_por_noche: h.precioPorNoche,
        // El rating de Booking va de 0 a 10 y el de Google de 0 a 5. Cuando
        // tenemos la ficha usamos la de Google, que es la escala que muestra
        // la UI (estrellas sobre 5).
        rating: coincide ? ficha.rating : null,
        latitud: h.latitud ?? (coincide ? ficha.latitud : null),
        longitud: h.longitud ?? (coincide ? ficha.longitud : null),
        url_referencia: JSON.stringify(metadata),
      };
    });
  }

  /**
   * Respaldo: sólo Google Places. Da fotos, rating y web, pero **sin precios**
   * — Places no publica tarifas de alojamiento.
   */
  private async desdeGooglePlaces(
    id_viaje: number,
    contexto: Parameters<
      GeminiService['sugerirAlojamientos']
    >[0] extends infer T
      ? Omit<T, 'hotelesDisponibles'>
      : never,
  ): Promise<OpcionAlojamientoNueva[]> {
    const hoteles = await this.googlePlaces.buscarAlojamientosGoogle(
      contexto.destino,
      8,
    );
    if (hoteles.length === 0) return [];

    const recomendaciones = await this.gemini.sugerirAlojamientos({
      ...contexto,
      hotelesDisponibles: hoteles.map((h) => ({
        id: h.id,
        nombre: h.nombre,
        direccion: h.direccion,
        rating: h.rating,
        userRatingCount: h.userRatingCount,
      })),
    });
    const porId = new Map(recomendaciones.map((r) => [r.id, r]));

    const recomendados = recomendaciones
      .map((r) => hoteles.find((h) => h.id === r.id))
      .filter((h): h is (typeof hoteles)[number] => h !== undefined);
    const resto = hoteles
      .filter((h) => !porId.has(h.id))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

    return [...recomendados, ...resto].slice(0, MAX_OPCIONES).map((h) => {
      const rec = porId.get(h.id);
      const metadata: MetadataAlojamiento = {
        url: h.websiteUri || h.googleMapsUri || null,
        fotoUrl: h.fotoUrl || null,
        fotos: h.fotos || [],
        // `razon` sólo si la IA calificó este hotel: si se rellena con un texto
        // genérico, el front le pone el sello "IA" a tarjetas que nunca miró.
        razon: rec?.razonRecomendacion ?? null,
        recomendadaIA: !!rec,
        precioReal: false,
        fuentePrecio: null,
        nivelPrecio: h.priceLevel ?? null,
      };

      return {
        id_viaje,
        nombre: h.nombre,
        tipo: 'Hotel',
        direccion: h.direccion,
        precio_por_noche: null,
        rating: h.rating,
        latitud: h.latitud,
        longitud: h.longitud,
        url_referencia: JSON.stringify(metadata),
      };
    });
  }

  /**
   * Elige (o descarta) una opción de alojamiento. La selección es exclusiva por
   * viaje y dispara el recálculo del presupuesto, que suma `precio_por_noche`
   * multiplicado por las noches del viaje.
   */
  async seleccionar(
    id_usuario: number,
    id_viaje: number,
    id_alojamiento: number,
    seleccionado: boolean,
  ) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const opcion = await this.prisma.opcionAlojamiento.findUnique({
      where: { id_alojamiento },
    });
    if (!opcion || opcion.id_viaje !== id_viaje) {
      throw new NotFoundException('Opción de alojamiento no encontrada');
    }

    await this.prisma.$transaction(async (tx) => {
      if (seleccionado) {
        await tx.opcionAlojamiento.updateMany({
          where: { id_viaje, seleccionado: true },
          data: { seleccionado: false },
        });
      }
      await tx.opcionAlojamiento.update({
        where: { id_alojamiento },
        data: { seleccionado },
      });
      await this.presupuestos.recalcularConTx(tx, id_viaje);
    });

    return this.listar(id_usuario, id_viaje);
  }

  async listar(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    // Por id, que es el orden en que se insertaron: primero los recomendados
    // por la IA. Ordenar por precio acá pisaría ese ranking.
    return this.prisma.opcionAlojamiento.findMany({
      where: { id_viaje },
      orderBy: { id_alojamiento: 'asc' },
    });
  }
}
