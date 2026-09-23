import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EsPasswordFuerte, PASSWORD_MIN } from './password-fuerte.decorator.js';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a1b2c3...',
    description: 'Token recibido por email.',
  })
  @IsString()
  @MinLength(1)
  token: string;

  @ApiProperty({
    example: 'MiPasswordNueva123!',
    minLength: PASSWORD_MIN,
    description:
      'Al menos 8 caracteres, con minúscula, mayúscula, número y un carácter especial.',
  })
  @EsPasswordFuerte()
  password_nueva: string;
}
