import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service.js';
import { UsuariosController } from './usuarios.controller.js';

@Module({
  providers: [UsuariosService],
  controllers: [UsuariosController],
})
export class UsuariosModule {}
