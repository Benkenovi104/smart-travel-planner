import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  EstadoSuscripcion,
  Plan,
  TipoConsumo,
} from '../../generated/prisma/enums.js';
import {
  ACCIONES_BUSQUEDA,
  ACCIONES_ITINERARIO,
  DIAS_DE_GRACIA,
  LIMITES,
  LimitesPlan,
  NOMBRE_PLAN,
  ORDEN_PLANES,
  PRECIO_MENSUAL_ARS,
  TOPE_DIARIO,
} from './planes.config.js';
import { periodoVigente } from './periodo.js';
import {
  LimitePlanException,
  TopeDiarioException,
} from './limite-plan.exception.js';
import { SuscripcionesService } from '../pagos/suscripciones.service.js';

type Tx = Prisma.TransactionClient;

const MS_DIA = 86_400_000;

/** Suscripciones por las que Mercado Pago sigue cobrando. */
const COBRANDO: EstadoSuscripcion[] = [
  EstadoSuscripcion.ACTIVA,
  EstadoSuscripcion.EN_GRACIA,
];

/**
 * Hasta cuántos días después del fin de lo pagado se sigue consultando a Mercado
 * Pago por una renovación. Pasado eso, si no cobró ni avisó, el plan ya venció.
 */
const DIAS_MAX_RECONCILIACION = 30;

export interface PlanVigente {
  plan: Plan;
  /** `null` en el plan Gratis, que no tiene fila de suscripción. */
  estado: EstadoSuscripcion | null;
  idSuscripcion: number | null;
  periodoDesde: Date;
  periodoHasta: Date;
  /** Hasta cuándo está pago. `null` en Gratis y en los planes asignados a mano. */
  vigenteHasta: Date | null;
}

/** Lo que hace falta de una suscripción para decidir si da acceso. */
interface SuscripcionEvaluable {
  id_suscripcion: number;
  plan: Plan;
  estado: EstadoSuscripcion;
  dia_ancla: Date;
  vigente_hasta: Date | null;
  cancelada_en: Date | null;
  creada_en: Date;
}

type AccionConLimite = Exclude<TipoConsumo, 'OPTIMIZAR_DIA'>;

const CLAVE_LIMITE: Record<
  AccionConLimite,
  Exclude<keyof LimitesPlan, 'optimizar'>
> = {
  CREAR_VIAJE: 'viajesPorPeriodo',
  GENERAR_ITINERARIO: 'generarPorViaje',
  REGENERAR_ITINERARIO: 'regenerarPorViaje',
  BUSCAR_ALOJAMIENTO: 'alojamientoPorViaje',
  BUSCAR_VUELOS: 'vuelosPorViaje',
};

@Injectable()
export class PlanesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suscripciones: SuscripcionesService,
  ) {}

  /**
   * El plan que tiene el usuario en este momento. **Se calcula al leer**: no hay
   * un proceso que actualice estados, así que una suscripción cuyo `vigente_hasta`
   * ya pasó se trata acá como en gracia o vencida según corresponda.
   *
   * Antes de eso, una suscripción de Mercado Pago que llegó al fin de lo pagado se
   * sincroniza con Mercado Pago: es el respaldo del webhook para las renovaciones,
   * por si el aviso del cobro mensual no llegó.
   *
   * Sin suscripción que dé acceso, el usuario está en Gratis, con el período
   * anclado a la fecha de registro o al fin de su último plan pago, lo que sea
   * más reciente.
   */
  async planVigente(
    id_usuario: number,
    ahora = new Date(),
  ): Promise<PlanVigente> {
    // PENDIENTE no da acceso: el usuario todavía no pagó.
    const leerSuscripciones = () =>
      this.prisma.suscripcion.findMany({
        where: { id_usuario, estado: { not: EstadoSuscripcion.PENDIENTE } },
        orderBy: { creada_en: 'desc' },
      });
    const [usuario, leidas] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id_usuario },
        select: { fecha_registro: true },
      }),
      leerSuscripciones(),
    ]);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const vencidas = leidas
      .filter(
        (s) =>
          s.mp_preapproval_id !== null &&
          COBRANDO.includes(s.estado) &&
          s.vigente_hasta !== null &&
          s.vigente_hasta.getTime() <= ahora.getTime() &&
          ahora.getTime() - s.vigente_hasta.getTime() <
            DIAS_MAX_RECONCILIACION * MS_DIA,
      )
      .map((s) => s.mp_preapproval_id as string);
    const suscripciones =
      vencidas.length > 0 &&
      (await this.suscripciones.reconciliarVencidas(vencidas))
        ? await leerSuscripciones()
        : leidas;

    let elegida: { s: SuscripcionEvaluable; estado: EstadoSuscripcion } | null =
      null;
    let finUltimoPlanPago: Date | null = null;

    for (const s of suscripciones) {
      const fin = this.finDeAcceso(s);
      const daAcceso =
        fin === null
          ? s.estado === EstadoSuscripcion.ACTIVA ||
            s.estado === EstadoSuscripcion.EN_GRACIA
          : ahora.getTime() < fin.getTime();

      if (daAcceso) {
        // Si hay más de una (una subida de plan antes de que se cancele la
        // anterior), gana la de mayor plan: el usuario ya pagó la nueva.
        if (!elegida || this.rango(s.plan) > this.rango(elegida.s.plan)) {
          elegida = { s, estado: this.estadoEfectivo(s, ahora) };
        }
      } else if (
        // Una que nunca se pagó (un checkout abandonado y dado de baja) no fue un
        // plan: no corre el período de Gratis.
        s.vigente_desde !== null &&
        fin !== null &&
        fin.getTime() <= ahora.getTime()
      ) {
        if (!finUltimoPlanPago || fin.getTime() > finUltimoPlanPago.getTime()) {
          finUltimoPlanPago = fin;
        }
      }
    }

    if (elegida) {
      const { desde, hasta } = periodoVigente(elegida.s.dia_ancla, ahora);
      return {
        plan: elegida.s.plan,
        estado: elegida.estado,
        idSuscripcion: elegida.s.id_suscripcion,
        periodoDesde: desde,
        periodoHasta: hasta,
        vigenteHasta: elegida.s.vigente_hasta,
      };
    }

    const ancla =
      finUltimoPlanPago &&
      finUltimoPlanPago.getTime() > usuario.fecha_registro.getTime()
        ? finUltimoPlanPago
        : usuario.fecha_registro;
    const { desde, hasta } = periodoVigente(ancla, ahora);
    return {
      plan: Plan.GRATIS,
      estado: null,
      idSuscripcion: null,
      periodoDesde: desde,
      periodoHasta: hasta,
      vigenteHasta: null,
    };
  }

  /**
   * Lanza `LimitePlanException` si el plan no permite la acción, o
   * `TopeDiarioException` si se pasó del tope anti-abuso. Se llama **antes** de
   * hacer la operación; el consumo se registra después, solo si salió bien.
   *
   * `id_viaje` es obligatorio salvo en `CREAR_VIAJE`, que se cuenta por período.
   */
  async verificar(
    id_usuario: number,
    accion: TipoConsumo,
    id_viaje?: number,
    ahora = new Date(),
  ): Promise<void> {
    const vigente = await this.planVigente(id_usuario, ahora);
    const limites = LIMITES[vigente.plan];

    if (accion === TipoConsumo.OPTIMIZAR_DIA) {
      if (!limites.optimizar) {
        throw new LimitePlanException({
          message: this.mensaje(accion, vigente.plan, 0),
          accion,
          planActual: vigente.plan,
          planSugerido: this.planQueHabilita(accion, vigente.plan, 0),
          limite: 0,
          usado: 0,
          renuevaEl: null,
        });
      }
      return;
    }

    const porPeriodo = accion === TipoConsumo.CREAR_VIAJE;
    if (!porPeriodo && id_viaje === undefined) {
      // Error de programación, no del usuario: sin el viaje contaría sobre todos.
      throw new Error(`${accion} se cuenta por viaje: falta id_viaje.`);
    }

    const limite = limites[CLAVE_LIMITE[accion]];
    if (limite !== null) {
      const usado =
        limite === 0
          ? 0
          : await this.prisma.consumo.count({
              where: porPeriodo
                ? {
                    id_usuario,
                    tipo: accion,
                    creado_en: {
                      gte: vigente.periodoDesde,
                      lt: vigente.periodoHasta,
                    },
                  }
                : { id_usuario, tipo: accion, id_viaje },
            });

      if (usado >= limite) {
        throw new LimitePlanException({
          message: this.mensaje(accion, vigente.plan, limite),
          accion,
          planActual: vigente.plan,
          planSugerido: this.planQueHabilita(accion, vigente.plan, usado),
          limite,
          usado,
          renuevaEl: porPeriodo ? vigente.periodoHasta : null,
        });
      }
    }

    await this.verificarTopeDiario(id_usuario, accion, ahora);
  }

  /**
   * Registra que el usuario consumió una acción. Recibe la transacción de la
   * operación que consume, para que ambas se confirmen o se descarten juntas.
   */
  async registrar(
    id_usuario: number,
    accion: TipoConsumo,
    id_viaje?: number,
    db: Tx = this.prisma,
  ): Promise<void> {
    await db.consumo.create({
      data: { id_usuario, tipo: accion, id_viaje: id_viaje ?? null },
    });
  }

  /** Plan, período y lo que lleva usado, para los medidores de la UI. */
  async uso(id_usuario: number, id_viaje?: number, ahora = new Date()) {
    const vigente = await this.planVigente(id_usuario, ahora);
    const limites = LIMITES[vigente.plan];
    const hace24h = new Date(ahora.getTime() - MS_DIA);
    const contar = (where: Prisma.ConsumoWhereInput) =>
      this.prisma.consumo.count({ where: { id_usuario, ...where } });

    const [viajes, itinerario24h, busquedas24h] = await Promise.all([
      contar({
        tipo: TipoConsumo.CREAR_VIAJE,
        creado_en: { gte: vigente.periodoDesde, lt: vigente.periodoHasta },
      }),
      contar({
        tipo: { in: [...ACCIONES_ITINERARIO] },
        creado_en: { gte: hace24h },
      }),
      contar({
        tipo: { in: [...ACCIONES_BUSQUEDA] },
        creado_en: { gte: hace24h },
      }),
    ]);

    let viaje: {
      idViaje: number;
      generarItinerario: { usado: number; limite: number | null };
      regenerarItinerario: { usado: number; limite: number | null };
      buscarAlojamiento: { usado: number; limite: number | null };
      buscarVuelos: { usado: number; limite: number | null };
      optimizar: boolean;
    } | null = null;

    if (id_viaje !== undefined) {
      const [generar, regenerar, alojamiento, vuelos] = await Promise.all(
        [
          TipoConsumo.GENERAR_ITINERARIO,
          TipoConsumo.REGENERAR_ITINERARIO,
          TipoConsumo.BUSCAR_ALOJAMIENTO,
          TipoConsumo.BUSCAR_VUELOS,
        ].map((tipo) => contar({ id_viaje, tipo })),
      );
      viaje = {
        idViaje: id_viaje,
        generarItinerario: { usado: generar, limite: limites.generarPorViaje },
        regenerarItinerario: {
          usado: regenerar,
          limite: limites.regenerarPorViaje,
        },
        buscarAlojamiento: {
          usado: alojamiento,
          limite: limites.alojamientoPorViaje,
        },
        buscarVuelos: { usado: vuelos, limite: limites.vuelosPorViaje },
        optimizar: limites.optimizar,
      };
    }

    return {
      ...vigente,
      nombrePlan: NOMBRE_PLAN[vigente.plan],
      limites,
      viajes: { usado: viajes, limite: limites.viajesPorPeriodo },
      viaje,
      topeDiario: {
        itinerario: { usado: itinerario24h, limite: TOPE_DIARIO.itinerario },
        busquedas: { usado: busquedas24h, limite: TOPE_DIARIO.busquedas },
      },
    };
  }

  /** Los planes con sus límites y precios, para la página de planes. */
  catalogo() {
    return {
      planes: ORDEN_PLANES.map((plan) => ({
        plan,
        nombre: NOMBRE_PLAN[plan],
        precioMensualArs: PRECIO_MENSUAL_ARS[plan],
        limites: LIMITES[plan],
      })),
      topeDiario: TOPE_DIARIO,
      diasDeGracia: DIAS_DE_GRACIA,
    };
  }

  private async verificarTopeDiario(
    id_usuario: number,
    accion: TipoConsumo,
    ahora: Date,
  ): Promise<void> {
    const grupo = ACCIONES_ITINERARIO.includes(accion)
      ? {
          tipos: ACCIONES_ITINERARIO,
          limite: TOPE_DIARIO.itinerario,
          nombre: 'generaciones de itinerario',
        }
      : ACCIONES_BUSQUEDA.includes(accion)
        ? {
            tipos: ACCIONES_BUSQUEDA,
            limite: TOPE_DIARIO.busquedas,
            nombre: 'búsquedas de vuelos y alojamiento',
          }
        : null;
    if (!grupo) return;

    const usado = await this.prisma.consumo.count({
      where: {
        id_usuario,
        tipo: { in: [...grupo.tipos] },
        creado_en: { gte: new Date(ahora.getTime() - MS_DIA) },
      },
    });

    if (usado >= grupo.limite) {
      throw new TopeDiarioException({
        message: `Llegaste al máximo de ${grupo.limite} ${grupo.nombre} en 24 horas. Volvé a intentar más tarde.`,
        accion,
        limite: grupo.limite,
        usado,
      });
    }
  }

  /**
   * Hasta cuándo da acceso una suscripción. `null` = sin fin (plan asignado a mano
   * que sigue activo). Los planes pagos suman los días de gracia a lo pagado; una
   * cancelada, en cambio, se corta exactamente al fin del período pagado.
   */
  private finDeAcceso(s: SuscripcionEvaluable): Date | null {
    switch (s.estado) {
      case EstadoSuscripcion.ACTIVA:
      case EstadoSuscripcion.EN_GRACIA:
        return s.vigente_hasta === null
          ? null
          : new Date(s.vigente_hasta.getTime() + DIAS_DE_GRACIA * MS_DIA);
      case EstadoSuscripcion.CANCELADA:
        return s.vigente_hasta ?? s.cancelada_en ?? s.creada_en;
      default:
        return s.vigente_hasta ?? s.creada_en;
    }
  }

  /** Una activa cuyo período pago ya terminó está, de hecho, en gracia. */
  private estadoEfectivo(
    s: SuscripcionEvaluable,
    ahora: Date,
  ): EstadoSuscripcion {
    const vencida =
      s.vigente_hasta !== null && ahora.getTime() >= s.vigente_hasta.getTime();
    return s.estado === EstadoSuscripcion.ACTIVA && vencida
      ? EstadoSuscripcion.EN_GRACIA
      : s.estado;
  }

  private rango(plan: Plan): number {
    return ORDEN_PLANES.indexOf(plan);
  }

  /** El plan más barato por encima del actual que permite hacer la acción. */
  private planQueHabilita(
    accion: TipoConsumo,
    actual: Plan,
    usado: number,
  ): Plan | null {
    for (const plan of ORDEN_PLANES.slice(this.rango(actual) + 1)) {
      const limites = LIMITES[plan];
      if (accion === TipoConsumo.OPTIMIZAR_DIA) {
        if (limites.optimizar) return plan;
        continue;
      }
      const limite = limites[CLAVE_LIMITE[accion]];
      if (limite === null || limite > usado) return plan;
    }
    return null;
  }

  private mensaje(accion: TipoConsumo, plan: Plan, limite: number): string {
    const nombre = NOMBRE_PLAN[plan];
    const veces = (n: number) => (n === 1 ? 'una vez' : `${n} veces`);
    const busquedas = (n: number) =>
      n === 1 ? '1 búsqueda' : `${n} búsquedas`;

    switch (accion) {
      case TipoConsumo.CREAR_VIAJE:
        return `Tu plan ${nombre} incluye ${limite} ${limite === 1 ? 'viaje' : 'viajes'} por período.`;
      case TipoConsumo.GENERAR_ITINERARIO:
        return `Tu plan ${nombre} permite generar el itinerario ${veces(limite)} por viaje.`;
      case TipoConsumo.REGENERAR_ITINERARIO:
        return limite === 0
          ? `Regenerar el itinerario no está incluido en el plan ${nombre}.`
          : `Tu plan ${nombre} permite regenerar el itinerario ${veces(limite)} por viaje.`;
      case TipoConsumo.BUSCAR_ALOJAMIENTO:
        return limite === 0
          ? `Buscar alojamiento no está incluido en el plan ${nombre}.`
          : `Tu plan ${nombre} incluye ${busquedas(limite)} de alojamiento por viaje.`;
      case TipoConsumo.BUSCAR_VUELOS:
        return limite === 0
          ? `Buscar vuelos no está incluido en el plan ${nombre}.`
          : `Tu plan ${nombre} incluye ${busquedas(limite)} de vuelos por viaje.`;
      case TipoConsumo.OPTIMIZAR_DIA:
        return `Optimizar el recorrido no está incluido en el plan ${nombre}.`;
    }
  }
}
