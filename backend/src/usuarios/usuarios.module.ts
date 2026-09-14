import { Module } from '@nestjs/common';
import { PagosModule } from '../pagos/pagos.module.js';
import { UsuariosService } from './usuarios.service.js';
import { UsuariosController } from './usuarios.controller.js';

@Module({
  // Borrar la cuenta cancela antes la suscripción de Mercado Pago.
  imports: [PagosModule],
  providers: [UsuariosService],
  controllers: [UsuariosController],
})
export class UsuariosModule {}
