import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

const CATEGORIAS_MAPEADAS = ['alojamiento', 'comida', 'transporte'] as const;

@Injectable()
export class PresupuestosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula y persiste el presupuesto de un viaje a partir de los costos
   * estimados de las actividades de su itinerario. Pensado para llamarse
   * desde dentro de una transacción ya abierta (generar/editar itinerario),
   * por eso recibe el `tx` en vez de abrir la suya propia.
   */
  async recalcularConTx(tx: Tx, id_viaje: number) {
    const itinerario = await tx.itinerario.findUnique({
      where: { id_viaje },
      include: {
        dias_itinerario: {
          include: { actividades_itinerario: { include: { lugares: true } } },
        },
      },
    });

    // Sin itinerario no hay nada de qué derivar el presupuesto todavía.
    if (!itinerario) return;

    const actividades = itinerario.dias_itinerario.flatMap(
      (dia) => dia.actividades_itinerario,
    );

    const sumaPorTipo = (tipo: (typeof CATEGORIAS_MAPEADAS)[number]) =>
      actividades
        .filter((a) => a.tipo_actividad === tipo)
        .reduce((acc, a) => acc + Number(a.costoEstimado ?? 0), 0);

    const monto_alojamiento = sumaPorTipo('alojamiento');
    const monto_comidas = sumaPorTipo('comida');
    const monto_transporte_local = sumaPorTipo('transporte');
    // El resto (visita, entretenimiento, sin tipo, etc.) cae en "actividades".
    const monto_actividades = actividades
      .filter(
        (a) =>
          !a.tipo_actividad ||
          !(CATEGORIAS_MAPEADAS as readonly string[]).includes(
            a.tipo_actividad,
          ),
      )
      .reduce((acc, a) => acc + Number(a.costoEstimado ?? 0), 0);
    // Sin integración de vuelos todavía (ver Bloque 5 del roadmap del backend).
    const monto_vuelos = 0;

    const monto_total =
      monto_vuelos +
      monto_alojamiento +
      monto_comidas +
      monto_transporte_local +
      monto_actividades;

    await tx.presupuesto.upsert({
      where: { id_viaje },
      create: {
        id_viaje,
        monto_total,
        monto_vuelos,
        monto_alojamiento,
        monto_actividades,
        monto_comidas,
        monto_transporte_local,
      },
      update: {
        monto_total,
        monto_vuelos,
        monto_alojamiento,
        monto_actividades,
        monto_comidas,
        monto_transporte_local,
      },
    });

    // El detalle línea por línea se recalcula desde cero cada vez.
    await tx.gastoEstimado.deleteMany({ where: { id_viaje } });
    const gastos = actividades
      .filter((a) => a.costoEstimado !== null && Number(a.costoEstimado) > 0)
      .map((a) => ({
        id_viaje,
        categoria: a.tipo_actividad ?? 'otro',
        descripcion: a.lugares.nombre,
        montoEstimado: a.costoEstimado,
      }));

    if (gastos.length > 0) {
      await tx.gastoEstimado.createMany({ data: gastos });
    }
  }

  async getPresupuesto(id_usuario: number, id_viaje: number) {
    const viaje = await this.prisma.viaje.findUnique({ where: { id_viaje } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (viaje.id_usuario !== id_usuario) throw new ForbiddenException();

    const presupuesto = await this.prisma.presupuesto.findUnique({
      where: { id_viaje },
    });
    if (!presupuesto) {
      throw new NotFoundException(
        'El viaje aún no tiene presupuesto calculado. Generá el itinerario primero.',
      );
    }

    const gastos_estimados = await this.prisma.gastoEstimado.findMany({
      where: { id_viaje },
      orderBy: { id_gasto: 'asc' },
    });

    return { ...presupuesto, gastos_estimados };
  }
}
