import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const RITMOS = ['relajado', 'moderado', 'intenso'];
const PRESUPUESTOS = ['económico', 'moderado', 'premium', 'lujo'];
const TIPOS = ['solo', 'pareja', 'familia', 'grupo', 'negocios'];

export class UpsertPerfilDto {
  @ApiPropertyOptional({ example: 'moderado', enum: RITMOS })
  @IsOptional()
  @IsString()
  @IsIn(RITMOS)
  ritmo_preferido?: string;

  @ApiPropertyOptional({ example: 'moderado', enum: PRESUPUESTOS })
  @IsOptional()
  @IsString()
  @IsIn(PRESUPUESTOS)
  presupuesto_preferido?: string;

  @ApiPropertyOptional({ example: 'pareja', enum: TIPOS })
  @IsOptional()
  @IsString()
  @IsIn(TIPOS)
  tipo_viajero?: string;
}
