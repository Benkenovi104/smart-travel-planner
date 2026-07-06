import {
  Controller,
  Post,
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
import { AlojamientoService } from './alojamiento.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Alojamiento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('viajes/:idViaje/alojamiento')
export class AlojamientoController {
  constructor(private readonly alojamientoService: AlojamientoService) {}

  @Post('buscar')
  @ApiOperation({
    summary:
      'Buscar opciones de alojamiento reales (Booking.com) para un viaje y guardarlas, ordenadas por precio por noche',
  })
  @ApiResponse({
    status: 201,
    description: 'Opciones de alojamiento encontradas y guardadas.',
  })
  buscar(@Request() req, @Param('idViaje', ParseIntPipe) idViaje: number) {
    return this.alojamientoService.buscarYGuardar(req.user.id_usuario, idViaje);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar las opciones de alojamiento guardadas de un viaje',
  })
  listar(@Request() req, @Param('idViaje', ParseIntPipe) idViaje: number) {
    return this.alojamientoService.listar(req.user.id_usuario, idViaje);
  }
}
