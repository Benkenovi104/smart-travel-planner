import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlanesService } from '../planes/planes.service.js';
import { TipoConsumo } from '../../generated/prisma/enums.js';
import { SkyScrapperService } from './sky-scrapper.service.js';
import { PresupuestosService } from '../presupuestos/presupuestos.service.js';

const MAX_OPCIONES = 5;

@Injectable()
export class VuelosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skyScrapper: SkyScrapperService,
    private readonly presupuestos: PresupuestosService,
    private readonly planes: PlanesService,
  ) {}

  async buscarYGuardar(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    // Antes de pegarle a Sky Scrapper: cada búsqueda gasta 4 requests de una cuota
    // que es de toda la app.
    await this.planes.verificar(
      id_usuario,
      TipoConsumo.BUSCAR_VUELOS,
      id_viaje,
    );

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
    // combinamos ida+vuelta por posición. OJO: son dos pasajes independientes,
    // no un producto de ida y vuelta de una aerolínea — la ida más barata puede
    // ser de una compañía y la vuelta de otra. Por eso cada tramo se persiste
    // con su propia aerolínea y precio, y la UI los muestra por separado en vez
    // de fingir un combo único.
    const idaOrdenada = [...vuelosIda].sort((a, b) => a.precio - b.precio);
    const vueltaOrdenada = [...vuelosVuelta].sort(
      (a, b) => a.precio - b.precio,
    );
    const cantidad = Math.min(
      MAX_OPCIONES,
      idaOrdenada.length,
      vueltaOrdenada.length || idaOrdenada.length,
    );

    // Sky Scrapper manda la hora local del aeropuerto SIN zona horaria
    // ("2026-09-14T21:55:00"). `new Date()` la interpreta en la zona del server
    // (UTC-3 acá) y la guardaría corrida 3 horas, al punto de mostrar la salida
    // un día después del que es. Se le agrega la Z para persistir el horario de
    // pared tal cual, igual que hace itinerarios.service.ts con las actividades.
    const fechaVuelo = (v?: string | null) => {
      if (!v) return null;
      const horaYZona = v.slice(10);
      const tieneZona =
        horaYZona.includes('Z') ||
        horaYZona.includes('+') ||
        horaYZona.lastIndexOf('-') > 0;
      return new Date(tieneZona ? v : `${v}Z`);
    };

    const opciones = idaOrdenada.slice(0, cantidad).map((ida, i) => {
      const vuelta = vueltaOrdenada[i];
      return {
        id_viaje,
        origen: ida.origen,
        destino: ida.destino,
        fechaSalida: fechaVuelo(ida.fecha)!,
        fecha_regreso: fechaVuelo(vuelta?.fecha) ?? undefined,
        aerolinea: ida.aerolinea,
        precio: ida.precio + (vuelta?.precio ?? 0),
        moneda: 'USD',
        duracion_total: ida.duracionMinutos + (vuelta?.duracionMinutos ?? 0),
        // Detalle por tramo, para que la UI pueda explicar qué se toma en cada
        // dirección en vez de mostrar un precio sumado y una sola aerolínea.
        aerolinea_vuelta: vuelta?.aerolinea ?? null,
        precio_ida: ida.precio,
        precio_vuelta: vuelta?.precio ?? null,
        duracion_ida: ida.duracionMinutos,
        duracion_vuelta: vuelta?.duracionMinutos ?? null,
        escalas_ida: ida.escalas,
        escalas_vuelta: vuelta?.escalas ?? null,
        llegada_ida: fechaVuelo(ida.llegada),
        llegada_vuelta: fechaVuelo(vuelta?.llegada),
      };
    });

    await this.prisma.$transaction(
      async (tx) => {
        // Reemplazar las opciones descarta la que estuviera seleccionada, así que
        // el presupuesto tiene que volver a calcularse sin ese vuelo.
        await tx.opcionVuelo.deleteMany({ where: { id_viaje } });
        if (opciones.length > 0) {
          await tx.opcionVuelo.createMany({ data: opciones });
          // Solo cuenta si trajo vuelos: una búsqueda vacía no le dio nada al
          // usuario, y en el plan Base es su única búsqueda del viaje.
          await this.planes.registrar(
            id_usuario,
            TipoConsumo.BUSCAR_VUELOS,
            id_viaje,
            tx,
          );
        }
        await this.presupuestos.recalcularConTx(tx, id_viaje);
        // Borrar y crear opciones, registrar el consumo y recalcular el presupuesto
        // son ~10 queries contra Supabase remoto: el default de 5 s queda justo.
      },
      { timeout: 20_000, maxWait: 10_000 },
    );

    return this.listar(id_usuario, id_viaje);
  }

  /**
   * Elige (o descarta) una opción de vuelo. La selección es exclusiva por viaje
   * y dispara el recálculo del presupuesto, que suma el vuelo elegido.
   */
  async seleccionar(
    id_usuario: number,
    id_viaje: number,
    id_vuelo: number,
    seleccionado: boolean,
  ) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const opcion = await this.prisma.opcionVuelo.findUnique({
      where: { id_vuelo },
    });
    if (!opcion || opcion.id_viaje !== id_viaje) {
      throw new NotFoundException('Opción de vuelo no encontrada');
    }

    await this.prisma.$transaction(async (tx) => {
      if (seleccionado) {
        await tx.opcionVuelo.updateMany({
          where: { id_viaje, seleccionado: true },
          data: { seleccionado: false },
        });
      }
      await tx.opcionVuelo.update({
        where: { id_vuelo },
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

    return this.prisma.opcionVuelo.findMany({
      where: { id_viaje },
      orderBy: { precio: 'asc' },
    });
  }
}
