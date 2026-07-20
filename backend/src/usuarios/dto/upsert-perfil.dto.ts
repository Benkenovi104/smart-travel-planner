import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertPerfilDto {
  @ApiPropertyOptional({ example: 'EQUILIBRADO' })
  @IsOptional()
  @IsString()
  ritmo_preferido?: string;

  @ApiPropertyOptional({ example: 'CONFORT' })
  @IsOptional()
  @IsString()
  presupuesto_preferido?: string;

  @ApiPropertyOptional({ example: 'pareja' })
  @IsOptional()
  @IsString()
  tipo_viajero?: string;
}
