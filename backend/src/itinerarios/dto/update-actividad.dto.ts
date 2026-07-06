import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const ESTADOS = ['pendiente', 'completada', 'cancelada'];

export class UpdateActividadDto {
  @ApiPropertyOptional({
    example: 'visita',
    enum: ['visita', 'comida', 'transporte', 'alojamiento', 'entretenimiento'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipo_actividad?: string;

  @ApiPropertyOptional({ example: '09:30' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'hora_inicio debe tener formato HH:mm' })
  hora_inicio?: string;

  @ApiPropertyOptional({ example: '11:30' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'hora_fin debe tener formato HH:mm' })
  hora_fin?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costo_estimado?: number;

  @ApiPropertyOptional({ example: 'completada', enum: ESTADOS })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: string;
}
