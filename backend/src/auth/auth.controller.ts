import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerificarEmailDto } from './dto/verificar-email.dto.js';
import { CambiarEmailDto } from './dto/cambiar-email.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado. Devuelve JWT.' })
  @ApiResponse({ status: 409, description: 'Email ya registrado.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso. Devuelve JWT.' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verificar-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar el email con el código recibido' })
  @ApiResponse({ status: 200, description: 'Email verificado.' })
  @ApiResponse({ status: 400, description: 'Código inválido o vencido.' })
  verificarEmail(@Request() req, @Body() dto: VerificarEmailDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.authService.verificarEmail(req.user.id_usuario, dto.codigo);
  }

  @Post('reenviar-verificacion')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pedir un código de verificación nuevo' })
  @ApiResponse({ status: 200, description: 'Código enviado.' })
  reenviarVerificacion(@Request() req) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.authService.reenviarVerificacion(req.user.id_usuario);
  }

  @Post('cambiar-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Corregir el email de una cuenta que todavía no verificó',
  })
  @ApiResponse({
    status: 200,
    description: 'Email actualizado; código enviado.',
  })
  @ApiResponse({ status: 400, description: 'La cuenta ya está verificada.' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado.' })
  cambiarEmail(@Request() req, @Body() dto: CambiarEmailDto) {
    return this.authService.cambiarEmailSinVerificar(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      req.user.id_usuario,
      dto.email,
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar la contraseña (autenticado)' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada.' })
  @ApiResponse({
    status: 401,
    description: 'La contraseña actual es incorrecta.',
  })
  changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.authService.changePassword(req.user.id_usuario, dto);
  }

  @Post('forgot-password')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar email para restablecer la contraseña' })
  @ApiResponse({
    status: 200,
    description: 'Respuesta genérica (no revela si el email existe).',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer la contraseña con el token del email' })
  @ApiResponse({ status: 200, description: 'Contraseña restablecida.' })
  @ApiResponse({ status: 400, description: 'Token inválido o vencido.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
