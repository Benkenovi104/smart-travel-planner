import { Module } from '@nestjs/common';
import { PerfilController } from './perfil.controller.js';
import { PerfilService } from './perfil.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PerfilController],
  providers: [PerfilService],
  exports: [PerfilService],
})
export class PerfilModule {}
