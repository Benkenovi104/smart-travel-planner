import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ViajesModule } from './viajes/viajes.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { ItinerariosModule } from './itinerarios/itinerarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ViajesModule,
    UsuariosModule,
    ItinerariosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
