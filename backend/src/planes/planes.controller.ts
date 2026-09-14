import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PlanesService } from './planes.service.js';

interface RequestWithUser {
  user: { id_usuario: number };
}

@ApiTags('Planes')
@Controller('planes')
export class PlanesController {
  constructor(private readonly planes: PlanesService) {}

  // Público a propósito: la página de planes se tiene que poder ver sin cuenta.
  @Get()
  @ApiOperation({
    summary: 'Catálogo de planes con sus límites y precios',
  })
  catalogo() {
    return this.planes.catalogo();
  }

  @Get('mi-plan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Plan vigente del usuario, su período y lo que lleva usado. Con idViaje, también los contadores de ese viaje.',
  })
  @ApiQuery({ name: 'idViaje', required: false, type: Number })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  miPlan(
    @Request() req: RequestWithUser,
    @Query('idViaje', new ParseIntPipe({ optional: true })) idViaje?: number,
  ) {
    return this.planes.uso(req.user.id_usuario, idViaje);
  }
}
