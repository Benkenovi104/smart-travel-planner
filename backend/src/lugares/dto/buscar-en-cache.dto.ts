import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BuscarEnCacheDto {
  @ApiProperty({
    example: 'museo',
    description: 'Texto a buscar por nombre entre los lugares ya cacheados.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  q: string;

  @ApiPropertyOptional({
    example: 'Mendoza',
    description:
      'Destino para acotar por ciudad. Se usa sólo el nombre de la ciudad (lo previo a la coma).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  destino?: string;
}
