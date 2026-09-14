import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Redirect,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { MercadoPagoService } from './mercado-pago.service.js';
import { SuscripcionesService } from './suscripciones.service.js';

/** Lo que manda Mercado Pago. Solo se usan el tipo y el id: el resto se pide a su API. */
export interface NotificacionMp {
  type?: string;
  data?: { id?: string | number };
}

export type ParametrosQuery = Record<string, string | string[] | undefined>;

const primero = (valor: string | string[] | undefined) =>
  Array.isArray(valor) ? valor[0] : valor;

// Lo llama Mercado Pago, no un usuario: sin JWT, y sin el límite por IP, que podría
// cortar una ráfaga legítima de notificaciones.
@ApiTags('Pagos')
@SkipThrottle()
@Controller('pagos')
export class PagosController {
  constructor(
    private readonly mercadoPago: MercadoPagoService,
    private readonly suscripciones: SuscripcionesService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Notificaciones de Mercado Pago. Público: la autenticidad se verifica con la firma x-signature y los datos se vuelven a pedir a la API de Mercado Pago.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificación procesada o ignorada.',
  })
  @ApiResponse({ status: 401, description: 'Firma inválida.' })
  async webhook(
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Query() query: ParametrosQuery,
    @Body() body: NotificacionMp,
  ) {
    // Mercado Pago firma con el data.id del query string.
    const idDelCuerpo = body?.data?.id;
    const dataId =
      primero(query['data.id']) ??
      (idDelCuerpo !== undefined ? String(idDelCuerpo) : undefined);

    if (!this.mercadoPago.firmaValida({ xSignature, xRequestId, dataId })) {
      throw new UnauthorizedException('Firma inválida');
    }

    if (dataId) {
      await this.suscripciones.procesarNotificacion(
        primero(query.type) ?? body?.type,
        dataId,
      );
    }
    return { recibido: true };
  }

  /**
   * Adónde vuelve el usuario después de pagar cuando el frontend no tiene una URL
   * https pública: Mercado Pago rechaza `http://localhost`. En desarrollo el túnel
   * apunta al backend, y esto lo manda al frontend conservando los parámetros.
   */
  @Get('volver')
  @Redirect()
  @ApiExcludeEndpoint()
  volver(@Query() query: ParametrosQuery) {
    const parametros = new URLSearchParams();
    for (const [clave, valor] of Object.entries(query)) {
      const v = primero(valor);
      if (v !== undefined) parametros.set(clave, v);
    }
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    const qs = parametros.toString();
    return {
      url: `${frontend}/planes/resultado${qs ? `?${qs}` : ''}`,
      statusCode: 302,
    };
  }
}
