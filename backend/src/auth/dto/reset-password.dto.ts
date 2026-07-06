import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a1b2c3...',
    description: 'Token recibido por email.',
  })
  @IsString()
  @MinLength(1)
  token: string;

  @ApiProperty({ example: 'miPasswordNueva123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password_nueva: string;
}
