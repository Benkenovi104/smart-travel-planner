import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class MoverActividadDto {
  @ApiProperty({
    example: 2,
    description:
      'ID del día destino. Puede ser el mismo día actual para solo reordenar.',
  })
  @IsInt()
  @Type(() => Number)
  id_dia_destino: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Posición destino dentro del día. Si se omite, se agrega al final.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  orden?: number;
}
