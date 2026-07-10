import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SeleccionarAlojamientoDto {
  @ApiProperty({
    example: true,
    description:
      'true elige esta opción (deselecciona cualquier otra del viaje); false la deselecciona.',
  })
  @IsBoolean()
  seleccionado: boolean;
}
