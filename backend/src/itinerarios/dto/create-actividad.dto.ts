import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateActividadDto {
  @ApiPropertyOptional({
    example: 42,
    description:
      'ID de un lugar ya existente. Si se omite, hay que enviar nombre_lugar para crear uno nuevo.',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id_lugar?: number;

  @ApiPropertyOptional({ example: 'Museo del Louvre' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nombre_lugar?: string;

  @ApiPropertyOptional({ example: 'París' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ciudad?: string;

  @ApiPropertyOptional({ example: 'Francia' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pais?: string;

  @ApiPropertyOptional({ example: 'museo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  precio_estimado?: number;

  @ApiPropertyOptional({
    example: 'visita',
    enum: ['visita', 'comida', 'transporte', 'alojamiento', 'entretenimiento'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipo_actividad?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'hora_inicio debe tener formato HH:mm' })
  hora_inicio?: string;

  @ApiPropertyOptional({ example: '11:00' })
  @IsOptional()
  @Matches(HORA_REGEX, { message: 'hora_fin debe tener formato HH:mm' })
  hora_fin?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costo_estimado?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Posición dentro del día. Si se omite, se agrega al final.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  orden?: number;
}
