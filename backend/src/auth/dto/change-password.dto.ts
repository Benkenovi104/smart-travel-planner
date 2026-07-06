import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'miPasswordActual123' })
  @IsString()
  @MinLength(1)
  password_actual: string;

  @ApiProperty({ example: 'miPasswordNueva123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password_nueva: string;
}
