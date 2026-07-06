import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { PresupuestosService } from './presupuestos.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Presupuestos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('viajes/:idViaje/presupuesto')
export class PresupuestosController {
  constructor(private readonly presupuestosService: PresupuestosService) {}

  @Get()
  @ApiOperation({
    summary:
      'Obtener el desglose de presupuesto de un viaje (se recalcula automáticamente al generar o editar el itinerario)',
  })
  @ApiResponse({
    status: 404,
    description: 'El viaje aún no tiene presupuesto calculado.',
  })
  getPresupuesto(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
  ) {
    return this.presupuestosService.getPresupuesto(
      req.user.id_usuario,
      idViaje,
    );
  }
}
