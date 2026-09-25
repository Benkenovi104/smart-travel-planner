import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerificarEmailDto {
  @ApiProperty({ example: '481203', description: 'Código de 6 dígitos.' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' })
  codigo: string;
}
