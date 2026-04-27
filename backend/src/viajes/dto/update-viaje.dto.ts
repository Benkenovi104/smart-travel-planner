import { PartialType } from '@nestjs/swagger';
import { CreateViajeDto } from './create-viaje.dto.js';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateViajeDto extends PartialType(CreateViajeDto) {
  @ApiPropertyOptional({ example: 'planificado', enum: ['planificado', 'en_progreso', 'completado', 'cancelado'] })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  estado?: string;
}
