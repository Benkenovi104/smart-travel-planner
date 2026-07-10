import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
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
import { ItinerariosService } from './itinerarios.service.js';
import { CreateActividadDto } from './dto/create-actividad.dto.js';
import { UpdateActividadDto } from './dto/update-actividad.dto.js';
import { MoverActividadDto } from './dto/mover-actividad.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Itinerarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('viajes/:idViaje/itinerario')
export class ItinerariosController {
  constructor(private readonly itinerariosService: ItinerariosService) {}

  @Post('generar')
  @ApiOperation({ summary: 'Generar itinerario con IA para un viaje' })
  @ApiResponse({ status: 201, description: 'Itinerario generado y guardado.' })
  @ApiResponse({ status: 404, description: 'Viaje no encontrado.' })
  generar(@Request() req, @Param('idViaje', ParseIntPipe) idViaje: number) {
    return this.itinerariosService.generar(req.user.id_usuario, idViaje);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener el itinerario de un viaje' })
  @ApiResponse({
    status: 404,
    description: 'El viaje aún no tiene itinerario.',
  })
  getItinerario(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
  ) {
    return this.itinerariosService.getItinerario(req.user.id_usuario, idViaje);
  }

  @Post('dias/:idDia/actividades')
  @ApiOperation({ summary: 'Agregar una actividad manualmente a un día' })
  @ApiResponse({ status: 201, description: 'Actividad agregada.' })
  @ApiResponse({ status: 404, description: 'Día o lugar no encontrado.' })
  agregarActividad(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
    @Param('idDia', ParseIntPipe) idDia: number,
    @Body() dto: CreateActividadDto,
  ) {
    return this.itinerariosService.agregarActividad(
      req.user.id_usuario,
      idViaje,
      idDia,
      dto,
    );
  }

  @Patch('actividades/:idActividad')
  @ApiOperation({ summary: 'Editar una actividad del itinerario' })
  @ApiResponse({ status: 404, description: 'Actividad no encontrada.' })
  editarActividad(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
    @Param('idActividad', ParseIntPipe) idActividad: number,
    @Body() dto: UpdateActividadDto,
  ) {
    return this.itinerariosService.editarActividad(
      req.user.id_usuario,
      idViaje,
      idActividad,
      dto,
    );
  }

  @Delete('actividades/:idActividad')
  @ApiOperation({ summary: 'Eliminar una actividad del itinerario' })
  @ApiResponse({ status: 404, description: 'Actividad no encontrada.' })
  eliminarActividad(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
    @Param('idActividad', ParseIntPipe) idActividad: number,
  ) {
    return this.itinerariosService.eliminarActividad(
      req.user.id_usuario,
      idViaje,
      idActividad,
    );
  }

  @Patch('actividades/:idActividad/mover')
  @ApiOperation({ summary: 'Mover o reordenar una actividad entre días' })
  @ApiResponse({ status: 404, description: 'Actividad o día no encontrado.' })
  moverActividad(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
    @Param('idActividad', ParseIntPipe) idActividad: number,
    @Body() dto: MoverActividadDto,
  ) {
    return this.itinerariosService.moverActividad(
      req.user.id_usuario,
      idViaje,
      idActividad,
      dto,
    );
  }

  @Post('dias/:idDia/optimizar')
  @ApiOperation({
    summary:
      'Optimizar el recorrido de un día: reordena las paradas por cercanía y corre los horarios',
  })
  @ApiResponse({ status: 404, description: 'Día no encontrado.' })
  @ApiResponse({
    status: 400,
    description: 'No hay suficientes actividades con ubicación.',
  })
  optimizarDia(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
    @Param('idDia', ParseIntPipe) idDia: number,
  ) {
    return this.itinerariosService.optimizarDia(
      req.user.id_usuario,
      idViaje,
      idDia,
    );
  }

  @Get('cambios')
  @ApiOperation({
    summary: 'Ver historial de cambios manuales del itinerario',
  })
  getHistorialCambios(
    @Request() req,
    @Param('idViaje', ParseIntPipe) idViaje: number,
  ) {
    return this.itinerariosService.getHistorialCambios(
      req.user.id_usuario,
      idViaje,
    );
  }

  @Post('geocodificar')
  @ApiOperation({
    summary:
      'Geolocalizar (Nominatim/OSM) las actividades del itinerario sin coordenadas',
  })
  geocodificar(@Request() req, @Param('idViaje', ParseIntPipe) idViaje: number) {
    return this.itinerariosService.geocodificarFaltantes(
      req.user.id_usuario,
      idViaje,
    );
  }
}
