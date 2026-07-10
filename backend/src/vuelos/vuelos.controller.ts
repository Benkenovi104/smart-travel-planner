import {
  Body,
  Controller,
  Post,
  Patch,
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
import { SeleccionarVueloDto } from './dto/seleccionar-vuelo.dto.js';
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

  @Patch(':idVuelo/seleccionar')
  @ApiOperation({
    summary:
      'Elegir (o descartar) una opción de vuelo. Es exclusiva por viaje y recalcula el presupuesto',
  })
  @ApiResponse({ status: 404, description: 'Opción de vuelo no encontrada.' })
  seleccionar(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
    @Param('idVuelo', ParseIntPipe) idVuelo: number,
    @Body() dto: SeleccionarVueloDto,
  ) {
    return this.vuelosService.seleccionar(
      req.user.id_usuario,
      idViaje,
      idVuelo,
      dto.seleccionado,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listar las opciones de vuelo guardadas de un viaje',
  })
  listar(@Request() req, @Param('idViaje', ParseIntPipe) idViaje: number) {
    return this.vuelosService.listar(req.user.id_usuario, idViaje);
  }
}
