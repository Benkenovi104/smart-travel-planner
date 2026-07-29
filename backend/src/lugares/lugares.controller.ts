import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LugaresService, CATEGORIAS_TURISTICAS } from './lugares.service.js';
import { BuscarLugaresDto } from './dto/buscar-lugares.dto.js';
import { BuscarEnCacheDto } from './dto/buscar-en-cache.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Lugares')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lugares')
export class LugaresController {
  constructor(private readonly lugaresService: LugaresService) {}

  @Get('ciudades/autocomplete')
  @ApiOperation({
    summary:
      'Sugerir ciudades/localidades para origen y destino vía Google Places Autocomplete',
  })
  autocompleteCiudades(@Query('q') query: string) {
    return this.lugaresService.autocompleteCiudades(query ?? '');
  }

  @Get()
  @ApiOperation({
    summary:
      'Buscar por texto entre los lugares ya cacheados (sin pegarle a Google Places). Para el autocompletado al agregar una actividad.',
  })
  buscarEnCache(@Query() query: BuscarEnCacheDto) {
    return this.lugaresService.buscarEnCache(query.q, query.destino);
  }

  @Get('buscar')
  @ApiOperation({
    summary:
      'Buscar lugares turísticos reales por destino (Google Places), cacheándolos en la base',
  })
  buscar(@Query() query: BuscarLugaresDto) {
    const claves = query.categorias
      ?.split(',')
      .map((c) => c.trim())
      .filter((c) => c in CATEGORIAS_TURISTICAS);

    const categorias = claves?.length
      ? Object.fromEntries(claves.map((c) => [c, CATEGORIAS_TURISTICAS[c]]))
      : undefined;

    return this.lugaresService.buscarYCachear(query.destino, categorias);
  }
}
