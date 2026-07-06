import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BuscarLugaresDto {
  @ApiProperty({ example: 'Mendoza, Argentina' })
  @IsString()
  @MaxLength(255)
  destino: string;

  @ApiPropertyOptional({
    example: 'museo,restaurante',
    description:
      'Claves de categoría separadas por coma (museo, atraccion_turistica, sitio_historico, monumento, parque, mirador, restaurante, cafe). Si se omite, se usa el set turístico completo.',
  })
  @IsOptional()
  @IsString()
  categorias?: string;
}
