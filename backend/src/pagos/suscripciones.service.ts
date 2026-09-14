import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EstadoSuscripcion, Plan } from '../../generated/prisma/enums.js';
import {
  DIAS_DE_GRACIA,
  NOMBRE_PLAN,
  ORDEN_PLANES,
  PRECIO_MENSUAL_ARS,
} from '../planes/planes.config.js';
import { periodoPagado } from '../planes/periodo.js';
import { type CobroMp, MercadoPagoService } from './mercado-pago.service.js';

export type PlanPago = Exclude<Plan, 'GRATIS'>;

// Estados de pago de Mercado Pago que cambian algo. Los demás (pendiente, en
// proceso) se ignoran hasta que se resuelvan.
const PAGO_APROBADO = 'approved';
const PAGO_RECHAZADO = 'rejected';

/** Suscripciones por las que Mercado Pago sigue cobrando. */
const COBRANDO: EstadoSuscripcion[] = [
  EstadoSuscripcion.ACTIVA,
  EstadoSuscripcion.EN_GRACIA,
];

const MS_DIA = 86_400_000;
const OPCIONES_TX = { timeout: 15_000, maxWait: 10_000 };

/** Cada cuánto se puede volver a consultar a Mercado Pago una suscripción vencida. */
const INTERVALO_RECONCILIACION_MS = 15 * 60_000;

const rango = (plan: Plan) => ORDEN_PLANES.indexOf(plan);

/**
 * Adónde vuelve el usuario después de pagar, con el id de la suscripción para que
 * la página de resultado sepa cuál consultar. Mercado Pago exige una URL https
 * pública y conserva el query string.
 */
const urlRetorno = (idSuscripcion: number) => {
  const url = new URL(
    process.env.MP_BACK_URL ||
      `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/planes/resultado`,
  );
  url.searchParams.set('idSuscripcion', String(idSuscripcion));
  return url.toString();
};

/** Un cobro nunca cuenta como hecho en el futuro: una fecha rara de la API no regala días. */
const fechaDelCobro = (cobro: CobroMp, ahora = new Date()) =>
  cobro.fecha && cobro.fecha.getTime() <= ahora.getTime() ? cobro.fecha : ahora;

interface SuscripcionACancelar {
  id_suscripcion: number;
  mp_preapproval_id: string | null;
}

@Injectable()
export class SuscripcionesService {
  private readonly logger = new Logger(SuscripcionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  /**
   * Crea la suscripción en Mercado Pago y devuelve el link de pago. **No activa
   * nada**: queda PENDIENTE hasta que Mercado Pago confirme el primer cobro.
   */
  async suscribir(id_usuario: number, plan: PlanPago, ahora = new Date()) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario },
      select: { email: true },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    await this.resolverPendientes(id_usuario);

    const cobrando = await this.prisma.suscripcion.findMany({
      where: {
        id_usuario,
        mp_preapproval_id: { not: null },
        estado: { in: COBRANDO },
      },
      select: { plan: true, vigente_hasta: true },
    });
    // Suscribirse a un plan igual o menor que uno que se sigue cobrando sería pagar
    // dos veces: para bajar, primero se cancela. Una que venció hace rato (ya pasó
    // la gracia) no bloquea; se cancela cuando se active la nueva.
    const bloqueante = cobrando.find(
      (s) =>
        rango(s.plan) >= rango(plan) &&
        (s.vigente_hasta === null ||
          s.vigente_hasta.getTime() + DIAS_DE_GRACIA * MS_DIA >
            ahora.getTime()),
    );
    if (bloqueante) {
      throw new ConflictException(
        bloqueante.plan === plan
          ? `Ya tenés el plan ${NOMBRE_PLAN[plan]}.`
          : `Tenés el plan ${NOMBRE_PLAN[bloqueante.plan]}. Para pasar a ${NOMBRE_PLAN[plan]}, primero cancelalo: lo conservás hasta el fin del período que pagaste.`,
      );
    }

    // El día ancla es provisorio: el real es el del primer cobro.
    const { id_suscripcion } = await this.prisma.suscripcion.create({
      data: {
        id_usuario,
        plan,
        estado: EstadoSuscripcion.PENDIENTE,
        dia_ancla: ahora,
      },
      select: { id_suscripcion: true },
    });

    try {
      const enMp = await this.mercadoPago.crearSuscripcion({
        idSuscripcion: id_suscripcion,
        motivo: `Smart Travel Planner — Plan ${NOMBRE_PLAN[plan]}`,
        // En el sandbox solo puede pagar la cuenta compradora de prueba.
        email: process.env.MP_PAYER_EMAIL_PRUEBA || usuario.email,
        monto: PRECIO_MENSUAL_ARS[plan],
        urlRetorno: urlRetorno(id_suscripcion),
      });
      await this.prisma.suscripcion.update({
        where: { id_suscripcion },
        data: { mp_preapproval_id: enMp.id },
      });
      return { idSuscripcion: id_suscripcion, initPoint: enMp.initPoint };
    } catch (error) {
      // Sin suscripción en Mercado Pago no hay nada que pagar: no dejar la fila.
      await this.prisma.suscripcion
        .delete({ where: { id_suscripcion } })
        .catch(() => undefined);
      throw error;
    }
  }

  /**
   * Cancela la suscripción paga: Mercado Pago deja de cobrar y el plan sigue
   * vigente hasta el fin del período pagado (`vigente_hasta` no se toca).
   */
  async cancelar(id_usuario: number) {
    const suscripciones = await this.cancelables(id_usuario);
    if (!suscripciones.some((s) => COBRANDO.includes(s.estado))) {
      throw new NotFoundException(
        'No tenés una suscripción paga para cancelar.',
      );
    }

    await this.cancelarEnMercadoPago(suscripciones);

    const vigenteHasta =
      suscripciones
        .map((s) => s.vigente_hasta)
        .filter((fecha): fecha is Date => fecha !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return {
      message:
        'Cancelamos tu suscripción. Conservás el plan hasta el fin del período que pagaste.',
      vigenteHasta,
    };
  }

  /** Para borrar la cuenta: cancela todo lo que Mercado Pago pueda seguir cobrando. */
  async cancelarTodas(id_usuario: number): Promise<void> {
    await this.cancelarEnMercadoPago(await this.cancelables(id_usuario));
  }

  /** Última consulta a Mercado Pago de cada suscripción vencida (en memoria). */
  private readonly ultimaReconciliacion = new Map<string, number>();

  /**
   * Respaldo del webhook para las renovaciones. `planVigente` la llama con las
   * suscripciones de Mercado Pago que llegaron al fin de lo pagado: si el aviso del
   * cobro mensual se perdió, sincronizar trae la renovación antes de que el plan
   * pase a gracia.
   *
   * Cada suscripción se consulta como mucho una vez cada 15 minutos (el registro
   * vive en memoria, así que vale por instancia del backend), y un error de Mercado
   * Pago no corta la acción del usuario: se sigue con lo que hay en la base.
   *
   * Devuelve `true` si sincronizó alguna, para que quien la llamó vuelva a leer.
   */
  async reconciliarVencidas(
    idsSuscripcionMp: string[],
    ahora = Date.now(),
  ): Promise<boolean> {
    let sincronizo = false;
    for (const id of idsSuscripcionMp) {
      const ultima = this.ultimaReconciliacion.get(id);
      if (
        ultima !== undefined &&
        ahora - ultima < INTERVALO_RECONCILIACION_MS
      ) {
        continue;
      }
      this.ultimaReconciliacion.set(id, ahora);
      try {
        await this.sincronizar(id);
        sincronizo = true;
      } catch (error) {
        this.logger.warn(
          `No se pudo reconciliar la suscripción ${id} con Mercado Pago: ${String(error)}`,
        );
      }
    }
    return sincronizo;
  }

  /**
   * Estado de una suscripción del usuario, para la página a la que vuelve después
   * de pagar. Si sigue pendiente se sincroniza con Mercado Pago, así el plan se
   * activa aunque el webhook no haya llegado. No abre un atajo: lo que activa es
   * la respuesta de la API de Mercado Pago, no el navegador.
   */
  async estado(id_usuario: number, id_suscripcion: number) {
    const buscar = () =>
      this.prisma.suscripcion.findFirst({
        where: { id_suscripcion, id_usuario },
        select: {
          id_suscripcion: true,
          plan: true,
          estado: true,
          mp_preapproval_id: true,
          vigente_hasta: true,
        },
      });

    let suscripcion = await buscar();
    if (!suscripcion) throw new NotFoundException('Suscripción no encontrada');

    if (
      suscripcion.estado === EstadoSuscripcion.PENDIENTE &&
      suscripcion.mp_preapproval_id
    ) {
      try {
        await this.sincronizar(suscripcion.mp_preapproval_id);
        suscripcion = (await buscar()) ?? suscripcion;
      } catch (error) {
        // Se informa lo que hay: el webhook la va a actualizar igual.
        this.logger.warn(
          `No se pudo sincronizar la suscripción ${id_suscripcion}: ${String(error)}`,
        );
      }
    }

    const ultimoPago = await this.prisma.pagoSuscripcion.findFirst({
      where: { id_suscripcion },
      orderBy: { creado_en: 'desc' },
      select: { estado: true, creado_en: true },
    });

    return {
      idSuscripcion: suscripcion.id_suscripcion,
      plan: suscripcion.plan,
      nombrePlan: NOMBRE_PLAN[suscripcion.plan],
      estado: suscripcion.estado,
      vigenteHasta: suscripcion.vigente_hasta,
      ultimoPago: ultimoPago
        ? { estado: ultimoPago.estado, fecha: ultimoPago.creado_en }
        : null,
    };
  }

  /**
   * Una notificación del webhook, ya con la firma validada. Del cuerpo solo se usan
   * el tipo y el id: el recurso se vuelve a pedir a la API, que no se puede
   * falsificar.
   */
  async procesarNotificacion(
    tipo: string | undefined,
    idRecurso: string,
  ): Promise<void> {
    switch (tipo) {
      case 'subscription_preapproval':
        return this.sincronizar(idRecurso);
      case 'subscription_authorized_payment': {
        const cobro = await this.mercadoPago.obtenerCobro(idRecurso);
        // Sin cobro válido no se sabe de qué suscripción es: la próxima
        // notificación o sincronización lo va a traer completo.
        if (!cobro?.idSuscripcionMp) return;
        return this.sincronizar(cobro.idSuscripcionMp, [cobro]);
      }
      default:
        this.logger.log(
          `Notificación de tipo ${tipo ?? '(sin tipo)'} ignorada`,
        );
    }
  }

  /**
   * Trae de Mercado Pago el estado de la suscripción y todos sus cobros, y los
   * aplica. Aplicar dos veces lo mismo no cambia nada: no importa cuántas veces ni
   * en qué orden lleguen las notificaciones.
   */
  async sincronizar(
    idSuscripcionMp: string,
    cobrosNotificados: CobroMp[] = [],
  ): Promise<void> {
    const suscripcion = await this.prisma.suscripcion.findUnique({
      where: { mp_preapproval_id: idSuscripcionMp },
      select: { id_suscripcion: true },
    });
    if (!suscripcion) {
      this.logger.warn(
        `Suscripción de Mercado Pago desconocida: ${idSuscripcionMp}`,
      );
      return;
    }
    const { id_suscripcion } = suscripcion;

    const [enMp, listados] = await Promise.all([
      this.mercadoPago.obtenerSuscripcion(idSuscripcionMp),
      this.mercadoPago.listarCobros(idSuscripcionMp),
    ]);

    // La búsqueda puede no traer todavía el cobro recién notificado. Van del más
    // viejo al más nuevo: cada cobro aprobado extiende desde donde dejó el anterior.
    const cobros = [
      ...new Map(
        [...listados, ...cobrosNotificados].map((c) => [c.id, c]),
      ).values(),
    ].sort(
      (a, b) =>
        (a.fecha?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.fecha?.getTime() ?? Number.MAX_SAFE_INTEGER),
    );

    for (const cobro of cobros) {
      if (cobro.estadoPago === PAGO_APROBADO) {
        await this.aplicarCobroAprobado(id_suscripcion, cobro);
      } else if (cobro.estadoPago === PAGO_RECHAZADO) {
        await this.aplicarCobroRechazado(id_suscripcion, cobro);
      }
    }

    if (enMp.status === 'cancelled' || enMp.status === 'paused') {
      await this.marcarCancelada(id_suscripcion);
    }

    const actual = await this.prisma.suscripcion.findUniqueOrThrow({
      where: { id_suscripcion },
      select: { id_usuario: true, estado: true, creada_en: true },
    });
    if (actual.estado === EstadoSuscripcion.ACTIVA) {
      // Subida de plan: la anterior se cancela recién ahora que la nueva está paga.
      // Cancelarla al suscribirse dejaba al usuario sin ninguna si el pago fallaba.
      await this.cancelarEnMercadoPago(
        await this.prisma.suscripcion.findMany({
          where: {
            id_usuario: actual.id_usuario,
            id_suscripcion: { not: id_suscripcion },
            mp_preapproval_id: { not: null },
            estado: { in: COBRANDO },
            creada_en: { lt: actual.creada_en },
          },
          select: { id_suscripcion: true, mp_preapproval_id: true },
        }),
      );
    }
  }

  private async aplicarCobroAprobado(id_suscripcion: number, cobro: CobroMp) {
    await this.prisma.$transaction(async (tx) => {
      // Bloquea la suscripción: dos notificaciones del mismo cobro que llegan juntas
      // se procesan de a una, y la segunda ya encuentra el pago registrado.
      await tx.$queryRaw`SELECT id_suscripcion FROM suscripciones WHERE id_suscripcion = ${id_suscripcion} FOR UPDATE`;

      const registrado = await tx.pagoSuscripcion.findUnique({
        where: { mp_payment_id: cobro.id },
      });
      if (registrado?.estado === PAGO_APROBADO) return;

      const s = await tx.suscripcion.findUniqueOrThrow({
        where: { id_suscripcion },
      });
      const fecha = fechaDelCobro(cobro);
      const primerCobro = s.vigente_hasta === null;
      const periodo = periodoPagado(s.dia_ancla, s.vigente_hasta, fecha);

      const pago = {
        estado: PAGO_APROBADO,
        monto: cobro.monto,
        periodo_desde: periodo.desde,
        periodo_hasta: periodo.hasta,
      };
      if (registrado) {
        // Un reintento aprobado de un cobro que antes se había rechazado.
        await tx.pagoSuscripcion.update({
          where: { mp_payment_id: cobro.id },
          data: pago,
        });
      } else {
        await tx.pagoSuscripcion.create({
          data: { id_suscripcion, mp_payment_id: cobro.id, ...pago },
        });
      }

      await tx.suscripcion.update({
        where: { id_suscripcion },
        data: {
          vigente_hasta: periodo.hasta,
          // El período se cuenta desde el día del primer pago: pagó el 13/08, renueva el 13/09.
          ...(primerCobro && { dia_ancla: fecha, vigente_desde: fecha }),
          // Reactiva también desde la gracia vencida: Mercado Pago reintenta solo y
          // un reintento puede aprobarse tarde. Una cancelada queda cancelada: el
          // cobro le da el período, pero no vuelve a renovarse.
          ...(s.estado !== EstadoSuscripcion.CANCELADA && {
            estado: EstadoSuscripcion.ACTIVA,
          }),
        },
      });
    }, OPCIONES_TX);
  }

  private async aplicarCobroRechazado(id_suscripcion: number, cobro: CobroMp) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_suscripcion FROM suscripciones WHERE id_suscripcion = ${id_suscripcion} FOR UPDATE`;

      // Ya registrado (rechazado antes, o aprobado en un reintento): nada nuevo.
      const registrado = await tx.pagoSuscripcion.findUnique({
        where: { mp_payment_id: cobro.id },
      });
      if (registrado) return;

      const s = await tx.suscripcion.findUniqueOrThrow({
        where: { id_suscripcion },
      });
      const periodo = periodoPagado(
        s.dia_ancla,
        s.vigente_hasta,
        fechaDelCobro(cobro),
      );
      await tx.pagoSuscripcion.create({
        data: {
          id_suscripcion,
          mp_payment_id: cobro.id,
          estado: PAGO_RECHAZADO,
          monto: cobro.monto,
          periodo_desde: periodo.desde,
          periodo_hasta: periodo.hasta,
        },
      });

      // Mientras Mercado Pago reintenta, el plan sigue en gracia. Un primer cobro
      // rechazado no activa nada: la suscripción queda pendiente.
      if (s.estado === EstadoSuscripcion.ACTIVA) {
        await tx.suscripcion.update({
          where: { id_suscripcion },
          data: { estado: EstadoSuscripcion.EN_GRACIA },
        });
      }
    }, OPCIONES_TX);
  }

  /**
   * Un checkout abandonado deja una suscripción pendiente. Antes de crear otra se
   * consulta a Mercado Pago: si al final se pagó, se activa; si no, se da de baja
   * para que ese link de pago ya no sirva.
   */
  private async resolverPendientes(id_usuario: number) {
    const pendientes = await this.prisma.suscripcion.findMany({
      where: { id_usuario, estado: EstadoSuscripcion.PENDIENTE },
      select: { id_suscripcion: true, mp_preapproval_id: true },
    });
    if (pendientes.length === 0) return;

    for (const { mp_preapproval_id } of pendientes) {
      if (mp_preapproval_id) await this.sincronizar(mp_preapproval_id);
    }

    await this.cancelarEnMercadoPago(
      await this.prisma.suscripcion.findMany({
        where: { id_usuario, estado: EstadoSuscripcion.PENDIENTE },
        select: { id_suscripcion: true, mp_preapproval_id: true },
      }),
    );
  }

  private cancelables(id_usuario: number) {
    return this.prisma.suscripcion.findMany({
      where: {
        id_usuario,
        mp_preapproval_id: { not: null },
        estado: { not: EstadoSuscripcion.CANCELADA },
      },
      select: {
        id_suscripcion: true,
        mp_preapproval_id: true,
        estado: true,
        vigente_hasta: true,
      },
    });
  }

  /**
   * Primero Mercado Pago y después la base, de a una: si Mercado Pago falla, esa
   * suscripción queda como estaba y el error sube. Nunca figura cancelada una
   * suscripción que se sigue cobrando.
   */
  private async cancelarEnMercadoPago(suscripciones: SuscripcionACancelar[]) {
    for (const s of suscripciones) {
      if (s.mp_preapproval_id) {
        await this.mercadoPago.cancelarSuscripcion(s.mp_preapproval_id);
      }
      await this.marcarCancelada(s.id_suscripcion);
    }
  }

  private async marcarCancelada(id_suscripcion: number) {
    await this.prisma.suscripcion.updateMany({
      where: { id_suscripcion, estado: { not: EstadoSuscripcion.CANCELADA } },
      data: { estado: EstadoSuscripcion.CANCELADA, cancelada_en: new Date() },
    });
  }
}
