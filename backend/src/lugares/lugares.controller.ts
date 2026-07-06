import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LugaresService, CATEGORIAS_TURISTICAS } from './lugares.service.js';
import { BuscarLugaresDto } from './dto/buscar-lugares.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Lugares')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lugares')
export class LugaresController {
  constructor(private readonly lugaresService: LugaresService) {}

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
