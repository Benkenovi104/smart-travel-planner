import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SuscribirDto } from './dto/suscribir.dto.js';
import { SuscripcionesService } from './suscripciones.service.js';

export interface RequestWithUser {
  user: { id_usuario: number };
}

// Comparte el prefijo /planes con PlanesController: para el usuario es todo parte
// de su plan, pero el cobro vive en el módulo de pagos.
@ApiTags('Planes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('planes')
export class SuscripcionesController {
  constructor(private readonly suscripciones: SuscripcionesService) {}

  @Post('suscribir')
  @ApiOperation({
    summary:
      'Crea la suscripción en Mercado Pago y devuelve el link de pago. El plan se activa recién cuando Mercado Pago confirma el cobro.',
  })
  @ApiResponse({
    status: 201,
    description:
      '{ idSuscripcion, initPoint }: redirigir al usuario a initPoint.',
  })
  @ApiResponse({ status: 400, description: 'El plan no es BASE ni PREMIUM.' })
  @ApiResponse({
    status: 409,
    description: 'Ya tiene ese plan, o uno mayor que todavía se le cobra.',
  })
  @ApiResponse({ status: 502, description: 'Mercado Pago falló.' })
  @ApiResponse({
    status: 503,
    description: 'Mercado Pago no está configurado.',
  })
  suscribir(@Request() req: RequestWithUser, @Body() dto: SuscribirDto) {
    return this.suscripciones.suscribir(req.user.id_usuario, dto.plan);
  }

  @Post('cancelar')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Cancela la suscripción paga. El plan sigue vigente hasta el fin del período pagado.',
  })
  @ApiResponse({ status: 404, description: 'No tiene una suscripción paga.' })
  @ApiResponse({
    status: 502,
    description: 'Mercado Pago falló: la suscripción no se canceló.',
  })
  cancelar(@Request() req: RequestWithUser) {
    return this.suscripciones.cancelar(req.user.id_usuario);
  }

  @Get('suscripciones/:id')
  @ApiOperation({
    summary:
      'Estado de una suscripción propia, para la página de retorno del pago. Si sigue pendiente, la sincroniza con Mercado Pago.',
  })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada.' })
  estado(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.suscripciones.estado(req.user.id_usuario, id);
  }
}
