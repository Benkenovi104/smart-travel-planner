import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  MaxLength,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateViajeDto {
  @ApiProperty({ example: 'Buenos Aires' })
  @IsString()
  @MaxLength(255)
  origen: string;

  @ApiProperty({ example: 'París' })
  @IsString()
  @MaxLength(255)
  destino_principal: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  fecha_inicio: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  fecha_fin: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cantidad_personas?: number;

  @ApiPropertyOptional({ example: 3000.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  presupuesto_total?: number;

  @ApiPropertyOptional({ example: [1, 3, 5], description: 'IDs de intereses' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  intereses?: number[];
}
