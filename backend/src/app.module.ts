import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ViajesModule } from './viajes/viajes.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { ItinerariosModule } from './itinerarios/itinerarios.module.js';
import { PresupuestosModule } from './presupuestos/presupuestos.module.js';
import { LugaresModule } from './lugares/lugares.module.js';
import { VuelosModule } from './vuelos/vuelos.module.js';
import { AlojamientoModule } from './alojamiento/alojamiento.module.js';
import { PerfilModule } from './perfil/perfil.module.js';
import { validate } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    AuthModule,
    ViajesModule,
    UsuariosModule,
    PerfilModule,
    ItinerariosModule,
    PresupuestosModule,
    LugaresModule,
    VuelosModule,
    AlojamientoModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
