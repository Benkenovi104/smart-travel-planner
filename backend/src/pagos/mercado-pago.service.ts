import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  InvalidWebhookSignatureError,
  Invoice,
  MercadoPagoConfig,
  MercadoPagoError,
  PreApproval,
  WebhookSignatureValidator,
} from 'mercadopago';

type RespuestaCobro = Awaited<ReturnType<Invoice['get']>>;

// La búsqueda de cobros responde 400 ("Invalid value for limit") con más de 15.
const COBROS_POR_PAGINA = 15;
// Tope de seguridad: 300 cobros son 25 años de una suscripción mensual.
const MAX_PAGINAS_COBROS = 20;

/** Un cobro recurrente de una suscripción (en la API, un "authorized payment"). */
export interface CobroMp {
  id: string;
  idSuscripcionMp: string | null;
  /** Estado del pago: `approved`, `rejected`... `null` si todavía no se intentó cobrar. */
  estadoPago: string | null;
  monto: number;
  fecha: Date | null;
}

export interface SuscripcionMp {
  id: string;
  /** `pending`, `authorized`, `paused` o `cancelled`. */
  status: string;
}

export interface DatosNuevaSuscripcion {
  idSuscripcion: number;
  motivo: string;
  email: string;
  monto: number;
  urlRetorno: string;
}

interface Clientes {
  token: string;
  preapproval: PreApproval;
  invoice: Invoice;
}

/**
 * Único punto de contacto con Mercado Pago: nada fuera de este servicio conoce su
 * API ni su SDK.
 *
 * Las credenciales se leen al usarlas y no al arrancar: el backend funciona sin
 * Mercado Pago configurado y solo los pagos responden 503.
 */
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private clientes: Clientes | null = null;

  /** Suscripción sin plan asociado y con pago pendiente: se paga en el `initPoint`. */
  async crearSuscripcion(
    datos: DatosNuevaSuscripcion,
  ): Promise<{ id: string; initPoint: string }> {
    const respuesta = await this.llamar('crear la suscripción', (c) =>
      c.preapproval.create({
        body: {
          reason: datos.motivo,
          external_reference: String(datos.idSuscripcion),
          payer_email: datos.email,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: datos.monto,
            // Mercado Pago Argentina no acepta suscripciones en otra moneda.
            currency_id: 'ARS',
          },
          back_url: datos.urlRetorno,
          status: 'pending',
        },
        // Si el SDK reintenta por un corte, no se crean dos suscripciones.
        requestOptions: {
          idempotencyKey: `suscripcion-${datos.idSuscripcion}`,
        },
      }),
    );

    if (!respuesta.id || !respuesta.init_point) {
      this.logger.error(
        'Mercado Pago creó la suscripción sin id o sin init_point',
      );
      throw new BadGatewayException(
        'Mercado Pago no devolvió el link de pago.',
      );
    }
    return { id: respuesta.id, initPoint: respuesta.init_point };
  }

  async obtenerSuscripcion(id: string): Promise<SuscripcionMp> {
    const respuesta = await this.llamar('consultar la suscripción', (c) =>
      c.preapproval.get({ id }),
    );
    return { id: respuesta.id ?? id, status: respuesta.status ?? '' };
  }

  /** Si ya estaba cancelada no es un error: el resultado buscado ya se cumple. */
  async cancelarSuscripcion(id: string): Promise<void> {
    try {
      await this.llamar('cancelar la suscripción', (c) =>
        // Con dos L: con "canceled" Mercado Pago responde 400.
        c.preapproval.update({ id, body: { status: 'cancelled' } }),
      );
    } catch (error) {
      // Una ya cancelada responde 400 ("You can not modify a cancelled
      // preapproval"). Se confirma consultando, sin depender del texto del error.
      const actual = await this.obtenerSuscripcion(id).catch(() => null);
      if (actual?.status === 'cancelled') return;
      throw error;
    }
  }

  async obtenerCobro(id: string): Promise<CobroMp> {
    const respuesta = await this.llamar('consultar el cobro', (c) =>
      c.invoice.get({ id }),
    );
    return aCobro(respuesta);
  }

  async listarCobros(idSuscripcionMp: string): Promise<CobroMp[]> {
    const cobros: CobroMp[] = [];
    for (let pagina = 0; pagina < MAX_PAGINAS_COBROS; pagina++) {
      const respuesta = await this.llamar('listar los cobros', (c) =>
        c.invoice.search({
          options: {
            preapproval_id: idSuscripcionMp,
            limit: COBROS_POR_PAGINA,
            offset: pagina * COBROS_POR_PAGINA,
          },
        }),
      );
      const resultados = respuesta.results ?? [];
      cobros.push(...resultados.map(aCobro));

      const total = respuesta.paging?.total;
      if (
        resultados.length < COBROS_POR_PAGINA ||
        (total !== undefined && cobros.length >= total)
      ) {
        break;
      }
    }
    return cobros;
  }

  /**
   * `true` si la notificación la firmó Mercado Pago con nuestra clave. La firma
   * cubre el id del recurso, el `x-request-id` y el timestamp, no el cuerpo: por
   * eso después el recurso se vuelve a pedir a la API.
   */
  firmaValida(datos: {
    xSignature?: string;
    xRequestId?: string;
    dataId?: string;
  }): boolean {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException(
        'Falta configurar MP_WEBHOOK_SECRET para validar las notificaciones.',
      );
    }

    try {
      WebhookSignatureValidator.validate({
        xSignature: datos.xSignature,
        xRequestId: datos.xRequestId,
        // Mercado Pago firma los ids alfanuméricos en minúsculas y el SDK no los
        // normaliza.
        dataId: datos.dataId?.toLowerCase(),
        secret,
      });
      return true;
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        this.logger.warn(
          `Notificación con firma inválida (${error.reason}), request ${error.requestId ?? '-'}`,
        );
        return false;
      }
      throw error;
    }
  }

  private async llamar<T>(
    que: string,
    operacion: (clientes: Clientes) => Promise<T>,
  ): Promise<T> {
    const clientes = this.clientesConfigurados();
    try {
      return await operacion(clientes);
    } catch (error) {
      const detalle =
        error instanceof MercadoPagoError
          ? `${error.status} ${error.message}`
          : String(error);
      this.logger.error(`Mercado Pago falló al ${que}: ${detalle}`);
      throw new BadGatewayException(
        `No pudimos ${que} en Mercado Pago. Probá de nuevo en unos minutos.`,
      );
    }
  }

  private clientesConfigurados(): Clientes {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException(
        'Los pagos no están disponibles: falta configurar Mercado Pago.',
      );
    }
    if (this.clientes?.token !== token) {
      const config = new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 10_000 },
      });
      this.clientes = {
        token,
        preapproval: new PreApproval(config),
        invoice: new Invoice(config),
      };
    }
    return this.clientes;
  }
}

function aCobro(cobro: RespuestaCobro): CobroMp {
  const fecha = new Date(cobro.debit_date ?? cobro.date_created ?? Number.NaN);
  return {
    id: String(cobro.id),
    idSuscripcionMp: cobro.preapproval_id ?? null,
    estadoPago: cobro.payment?.status ?? null,
    monto: Number(cobro.transaction_amount ?? 0),
    fecha: Number.isNaN(fecha.getTime()) ? null : fecha,
  };
}
