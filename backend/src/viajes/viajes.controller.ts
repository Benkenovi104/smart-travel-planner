import {
  Controller,
  Get,
  Post,
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
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ViajesService } from './viajes.service.js';
import { CreateViajeDto } from './dto/create-viaje.dto.js';
import { UpdateViajeDto } from './dto/update-viaje.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Viajes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('viajes')
export class ViajesController {
  constructor(private readonly viajesService: ViajesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo viaje' })
  @ApiResponse({ status: 201, description: 'Viaje creado exitosamente.' })
  create(@Request() req, @Body() dto: CreateViajeDto) {
    return this.viajesService.create(req.user.id_usuario, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los viajes del usuario autenticado' })
  findAll(@Request() req) {
    return this.viajesService.findAll(req.user.id_usuario);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un viaje por ID' })
  @ApiResponse({ status: 404, description: 'Viaje no encontrado.' })
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.viajesService.findOne(req.user.id_usuario, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un viaje' })
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateViajeDto,
  ) {
    return this.viajesService.update(req.user.id_usuario, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un viaje' })
  remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.viajesService.remove(req.user.id_usuario, id);
  }
}
