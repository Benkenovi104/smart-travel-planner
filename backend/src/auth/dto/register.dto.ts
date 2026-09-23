import { IsEmail, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EsPasswordFuerte, PASSWORD_MIN } from './password-fuerte.decorator.js';

export class RegisterDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @MaxLength(100)
  apellido: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'MiPassword123!',
    minLength: PASSWORD_MIN,
    description:
      'Al menos 8 caracteres, con minúscula, mayúscula, número y un carácter especial.',
  })
  @EsPasswordFuerte()
  password: string;
}
