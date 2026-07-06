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
import { VuelosService } from './vuelos.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Vuelos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('viajes/:idViaje/vuelos')
export class VuelosController {
  constructor(private readonly vuelosService: VuelosService) {}

  @Post('buscar')
  @ApiOperation({
    summary:
      'Buscar opciones de vuelo reales (Sky Scrapper) para un viaje y guardarlas, ordenadas por precio',
  })
  @ApiResponse({
    status: 201,
    description: 'Opciones de vuelo encontradas y guardadas.',
  })
  buscar(@Request() req, @Param('idViaje', ParseIntPipe) idViaje: number) {
    return this.vuelosService.buscarYGuardar(req.user.id_usuario, idViaje);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar las opciones de vuelo guardadas de un viaje',
  })
  listar(@Request() req, @Param('idViaje', ParseIntPipe) idViaje: number) {
    return this.vuelosService.listar(req.user.id_usuario, idViaje);
  }
}
