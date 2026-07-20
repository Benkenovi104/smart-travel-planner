import { IsEnum, IsArray, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RitmoViaje,
  NivelPresupuesto,
  PreferenciaDietaria,
  NecesidadMovilidad,
} from '../../../generated/prisma/enums.js';

export class SavePerfilDto {
  @ApiProperty({ enum: RitmoViaje, example: RitmoViaje.EQUILIBRADO })
  @IsEnum(RitmoViaje)
  ritmoPreferido: RitmoViaje;

  @ApiProperty({ enum: NivelPresupuesto, example: NivelPresupuesto.CONFORT })
  @IsEnum(NivelPresupuesto)
  presupuestoPreferido: NivelPresupuesto;

  @ApiPropertyOptional({
    enum: PreferenciaDietaria,
    isArray: true,
    example: [PreferenciaDietaria.NINGUNA],
  })
  @IsArray()
  @IsEnum(PreferenciaDietaria, { each: true })
  @IsOptional()
  dietas?: PreferenciaDietaria[];

  @ApiPropertyOptional({
    enum: NecesidadMovilidad,
    isArray: true,
    example: [NecesidadMovilidad.NINGUNA],
  })
  @IsArray()
  @IsEnum(NecesidadMovilidad, { each: true })
  @IsOptional()
  movilidad?: NecesidadMovilidad[];

  @ApiProperty({
    type: [Number],
    example: [1, 2, 3],
    description: 'Lista de IDs de intereses seleccionados',
  })
  @IsArray()
  @IsInt({ each: true })
  interesesIds: number[];
}
