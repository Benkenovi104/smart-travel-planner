import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { PerfilService } from './perfil.service.js';
import { SavePerfilDto } from './dto/save-perfil.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface RequestWithUser {
  user: {
    id_usuario?: number;
    idUsuario?: number;
  };
}

@ApiTags('Perfil Viajero')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Obtener el perfil e intereses del usuario autenticado',
  })
  @ApiResponse({ status: 200, description: 'Perfil obtenido correctamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  obtenerPerfil(@Request() req: RequestWithUser) {
    const idUsuario = (req.user.id_usuario ?? req.user.idUsuario)!;
    return this.perfilService.obtenerPerfil(idUsuario);
  }

  @Post('me')
  @ApiOperation({ summary: 'Guardar/Actualizar perfil e intereses en batch' })
  @ApiResponse({ status: 200, description: 'Perfil guardado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  guardarPerfilPost(
    @Request() req: RequestWithUser,
    @Body() dto: SavePerfilDto,
  ) {
    const idUsuario = (req.user.id_usuario ?? req.user.idUsuario)!;
    return this.perfilService.guardarPerfil(idUsuario, dto);
  }

  @Put('me')
  @ApiOperation({ summary: 'Guardar/Actualizar perfil e intereses en batch' })
  @ApiResponse({ status: 200, description: 'Perfil guardado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  guardarPerfilPut(
    @Request() req: RequestWithUser,
    @Body() dto: SavePerfilDto,
  ) {
    const idUsuario = (req.user.id_usuario ?? req.user.idUsuario)!;
    return this.perfilService.guardarPerfil(idUsuario, dto);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Guardar/Actualizar perfil e intereses en batch' })
  @ApiResponse({ status: 200, description: 'Perfil guardado correctamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  guardarPerfilPatch(
    @Request() req: RequestWithUser,
    @Body() dto: SavePerfilDto,
  ) {
    const idUsuario = (req.user.id_usuario ?? req.user.idUsuario)!;
    return this.perfilService.guardarPerfil(idUsuario, dto);
  }

  @Get('me/status')
  @ApiOperation({ summary: 'Obtener el estado del onboarding (completado)' })
  @ApiResponse({ status: 200, description: 'Estado obtenido correctamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  obtenerEstadoOnboarding(@Request() req: RequestWithUser) {
    const idUsuario = (req.user.id_usuario ?? req.user.idUsuario)!;
    return this.perfilService.obtenerEstadoOnboarding(idUsuario);
  }
}
