import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import { UpsertPerfilDto } from './dto/upsert-perfil.dto.js';
import { AddInteresDto } from './dto/add-interes.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener mi perfil completo' })
  getMe(@Request() req) {
    return this.usuariosService.getMe(req.user.id_usuario);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar nombre y apellido' })
  updateMe(@Request() req, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.updateMe(req.user.id_usuario, dto);
  }

  @Patch('me/perfil')
  @ApiOperation({ summary: 'Crear o actualizar perfil de viajero' })
  upsertPerfil(@Request() req, @Body() dto: UpsertPerfilDto) {
    return this.usuariosService.upsertPerfil(req.user.id_usuario, dto);
  }

  @Get('intereses')
  @ApiOperation({ summary: 'Listar todos los intereses disponibles' })
  getAllIntereses() {
    return this.usuariosService.getAllIntereses();
  }

  @Get('me/intereses')
  @ApiOperation({ summary: 'Ver mis intereses' })
  getIntereses(@Request() req) {
    return this.usuariosService.getIntereses(req.user.id_usuario);
  }

  @Post('me/intereses')
  @ApiOperation({ summary: 'Agregar un interés a mi perfil' })
  @ApiResponse({ status: 409, description: 'El interés ya está agregado.' })
  addInteres(@Request() req, @Body() dto: AddInteresDto) {
    return this.usuariosService.addInteres(req.user.id_usuario, dto);
  }

  @Delete('me/intereses/:idInteres')
  @ApiOperation({ summary: 'Eliminar un interés de mi perfil' })
  removeInteres(
    @Request() req,
    @Param('idInteres', ParseIntPipe) idInteres: number,
  ) {
    return this.usuariosService.removeInteres(req.user.id_usuario, idInteres);
  }
}
