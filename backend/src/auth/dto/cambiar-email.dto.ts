import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CambiarEmailDto {
  @ApiProperty({
    example: 'juan@example.com',
    description: 'La dirección correcta. Se le manda un código nuevo.',
  })
  @IsEmail()
  email: string;
}
