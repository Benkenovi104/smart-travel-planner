import { Controller, Post, Get, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ItinerariosService } from './itinerarios.service.js';
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
  @ApiResponse({ status: 404, description: 'El viaje aún no tiene itinerario.' })
  getItinerario(@Request() req, @Param('idViaje', ParseIntPipe) idViaje: number) {
    return this.itinerariosService.getItinerario(req.user.id_usuario, idViaje);
  }
}
