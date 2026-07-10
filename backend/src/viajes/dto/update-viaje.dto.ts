import { PartialType } from '@nestjs/swagger';
import { CreateViajeDto } from './create-viaje.dto.js';
import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ESTADOS_VIAJE } from './estados-viaje.js';
import type { EstadoViaje } from './estados-viaje.js';

export class UpdateViajeDto extends PartialType(CreateViajeDto) {
  // `IsIn` y no `IsString`: el `enum` de Swagger es sólo documentación y antes
  // dejaba pasar cualquier string de hasta 50 caracteres como estado.
  @ApiPropertyOptional({ example: 'planificado', enum: ESTADOS_VIAJE })
  @IsOptional()
  @IsIn(ESTADOS_VIAJE)
  estado?: EstadoViaje;
}
