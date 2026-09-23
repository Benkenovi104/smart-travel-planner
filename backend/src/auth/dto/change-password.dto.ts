import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EsPasswordFuerte, PASSWORD_MIN } from './password-fuerte.decorator.js';

export class ChangePasswordDto {
  @ApiProperty({ example: 'miPasswordActual123' })
  @IsString()
  @MinLength(1)
  password_actual: string;

  @ApiProperty({
    example: 'MiPasswordNueva123!',
    minLength: PASSWORD_MIN,
    description:
      'Al menos 8 caracteres, con minúscula, mayúscula, número y un carácter especial.',
  })
  @EsPasswordFuerte()
  password_nueva: string;
}
