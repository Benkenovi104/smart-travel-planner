import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/**
 * Tipos de actividad que tienen su propia categoría de presupuesto. El resto cae
 * en "actividades". `alojamiento` sigue acá, aunque ya no sea un tipo válido, para
 * que las actividades de itinerarios viejos no se cuelen dentro de "actividades".
 */
const CATEGORIAS_MAPEADAS = ['alojamiento', 'comida', 'transporte'] as const;

@Injectable()
export class PresupuestosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula y persiste el presupuesto de un viaje a partir de los costos
   * estimados de las actividades de su itinerario, más la opción de vuelo y de
   * alojamiento que el usuario haya seleccionado. Pensado para llamarse desde
   * dentro de una transacción ya abierta (generar/editar itinerario, elegir una
   * opción), por eso recibe el `tx` en vez de abrir la suya propia.
   */
  async recalcularConTx(tx: Tx, id_viaje: number) {
    const [viaje, itinerario, vueloSel, alojamientoSel] = await Promise.all([
      tx.viaje.findUnique({ where: { id_viaje } }),
      tx.itinerario.findUnique({
        where: { id_viaje },
        include: {
          dias_itinerario: {
            include: { actividades_itinerario: { include: { lugares: true } } },
          },
        },
      }),
      tx.opcionVuelo.findFirst({ where: { id_viaje, seleccionado: true } }),
      tx.opcionAlojamiento.findFirst({
        where: { id_viaje, seleccionado: true },
      }),
    ]);

    if (!viaje) return;

    // Sin itinerario ni opciones elegidas no hay nada de qué derivar el
    // presupuesto todavía: dejamos que `getPresupuesto` siga devolviendo 404.
    // Si ya existe una fila igual seguimos, para poder bajarla a cero cuando se
    // deselecciona la última opción de un viaje que todavía no tiene itinerario.
    if (!itinerario && !vueloSel && !alojamientoSel) {
      const yaExiste = await tx.presupuesto.findUnique({ where: { id_viaje } });
      if (!yaExiste) return;
    }

    const actividades =
      itinerario?.dias_itinerario.flatMap((dia) => dia.actividades_itinerario) ??
      [];

    const sumaPorTipo = (tipo: (typeof CATEGORIAS_MAPEADAS)[number]) =>
      actividades
        .filter((a) => a.tipo_actividad === tipo)
        .reduce((acc, a) => acc + Number(a.costoEstimado ?? 0), 0);

    // El vuelo guardado ya es el total ida+vuelta para todo el grupo: la
    // búsqueda consulta la API con `cantidadPersonas` adultos.
    const monto_vuelos = Number(vueloSel?.precio ?? 0);

    // El alojamiento es un costo del viaje, no de un día: sale exclusivamente del
    // hotel elegido. Las actividades tipo "alojamiento" de itinerarios viejos no
    // suman ni aparecen en el detalle.
    // `precio_por_noche` viene prorrateado para el grupo entero.
    const noches = this.nochesDe(viaje.fechaInicio, viaje.fechaFin);
    const monto_alojamiento =
      Number(alojamientoSel?.precio_por_noche ?? 0) * noches;

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

    const gastos: Prisma.GastoEstimadoCreateManyInput[] = [];

    if (vueloSel && monto_vuelos > 0) {
      gastos.push({
        id_viaje,
        categoria: 'vuelo',
        descripcion: [vueloSel.aerolinea, `${vueloSel.origen} → ${vueloSel.destino}`]
          .filter(Boolean)
          .join(' · '),
        montoEstimado: vueloSel.precio,
      });
    }

    if (alojamientoSel && monto_alojamiento > 0) {
      gastos.push({
        id_viaje,
        categoria: 'alojamiento',
        descripcion: `${alojamientoSel.nombre ?? 'Alojamiento'} · ${noches} ${
          noches === 1 ? 'noche' : 'noches'
        }`,
        montoEstimado: monto_alojamiento,
      });
    }

    for (const a of actividades) {
      if (a.costoEstimado === null || Number(a.costoEstimado) <= 0) continue;
      // El alojamiento nunca sale del itinerario (ver `monto_alojamiento`).
      if (a.tipo_actividad === 'alojamiento') continue;
      gastos.push({
        id_viaje,
        categoria: a.tipo_actividad ?? 'otro',
        descripcion: a.lugares.nombre,
        montoEstimado: a.costoEstimado,
      });
    }

    if (gastos.length > 0) {
      await tx.gastoEstimado.createMany({ data: gastos });
    }
  }

  /** Noches entre dos fechas, con mínimo 1 (mismo criterio que la búsqueda de alojamiento). */
  private nochesDe(fechaInicio: Date, fechaFin: Date): number {
    return Math.max(
      1,
      Math.round(
        (fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
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
