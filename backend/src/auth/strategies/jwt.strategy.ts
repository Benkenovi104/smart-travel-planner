import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface JwtPayload {
  sub: number;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  /**
   * Verifica contra la base que el usuario del token siga existiendo. Sin esto,
   * el JWT de una cuenta borrada seguiría pasando el guard hasta vencer (7 días)
   * y las rutas devolverían 404 en vez de 401.
   *
   * Cuesta una query por request autenticado; a cambio, borrar la cuenta corta
   * el acceso de inmediato en todos los dispositivos.
   */
  async validate(payload: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id_usuario: payload.sub },
      select: { id_usuario: true, email: true },
    });

    if (!usuario) throw new UnauthorizedException('Credenciales inválidas');

    return { id_usuario: usuario.id_usuario, email: usuario.email };
  }
}
