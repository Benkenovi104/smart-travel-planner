import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SkyScrapperService } from './sky-scrapper.service.js';

const MAX_OPCIONES = 5;

@Injectable()
export class VuelosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skyScrapper: SkyScrapperService,
  ) {}

  async buscarYGuardar(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const [origen, destino] = await Promise.all([
      this.skyScrapper.resolverAeropuerto(viaje.origen),
      this.skyScrapper.resolverAeropuerto(viaje.destino_principal),
    ]);

    if (!origen || !destino) {
      throw new BadRequestException(
        'No se pudo resolver el origen o destino para buscar vuelos',
      );
    }

    const fechaIda = viaje.fechaInicio.toISOString().split('T')[0];
    const fechaVuelta = viaje.fechaFin.toISOString().split('T')[0];
    const adultos = viaje.cantidadPersonas ?? 1;

    const [vuelosIda, vuelosVuelta] = await Promise.all([
      this.skyScrapper.buscarVuelos({
        origen,
        destino,
        fecha: fechaIda,
        adultos,
      }),
      this.skyScrapper.buscarVuelos({
        origen: destino,
        destino: origen,
        fecha: fechaVuelta,
        adultos,
      }),
    ]);

    // Rankeamos por precio ascendente (criterio: ajuste al presupuesto) y
    // combinamos ida+vuelta por posición para armar opciones de ida y vuelta.
    const idaOrdenada = [...vuelosIda].sort((a, b) => a.precio - b.precio);
    const vueltaOrdenada = [...vuelosVuelta].sort(
      (a, b) => a.precio - b.precio,
    );
    const cantidad = Math.min(
      MAX_OPCIONES,
      idaOrdenada.length,
      vueltaOrdenada.length || idaOrdenada.length,
    );

    const opciones = idaOrdenada.slice(0, cantidad).map((ida, i) => {
      const vuelta = vueltaOrdenada[i];
      return {
        id_viaje,
        origen: ida.origen,
        destino: ida.destino,
        fechaSalida: new Date(ida.fecha),
        fecha_regreso: vuelta ? new Date(vuelta.fecha) : undefined,
        aerolinea: ida.aerolinea,
        precio: ida.precio + (vuelta?.precio ?? 0),
        moneda: 'USD',
        duracion_total: ida.duracionMinutos + (vuelta?.duracionMinutos ?? 0),
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.opcionVuelo.deleteMany({ where: { id_viaje } });
      if (opciones.length > 0) {
        await tx.opcionVuelo.createMany({ data: opciones });
      }
    });

    return this.listar(id_usuario, id_viaje);
  }

  async listar(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    return this.prisma.opcionVuelo.findMany({
      where: { id_viaje },
      orderBy: { precio: 'asc' },
    });
  }
}
