import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddInteresDto {
  @ApiProperty({ example: 1, description: 'ID del interés' })
  @IsInt()
  @Type(() => Number)
  id_interes: number;

  @ApiPropertyOptional({ example: 1, description: 'Prioridad del 1 (alta) al 5 (baja)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  prioridad?: number;
}
