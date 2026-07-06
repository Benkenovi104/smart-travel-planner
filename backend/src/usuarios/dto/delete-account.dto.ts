import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({
    example: 'miPassword123',
    description: 'Contraseña actual, requerida para confirmar el borrado.',
  })
  @IsString()
  @MinLength(1)
  password: string;
}
