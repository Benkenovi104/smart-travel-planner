import { describe, it, expect } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './register.dto.js';
import { ResetPasswordDto } from './reset-password.dto.js';
import { ChangePasswordDto } from './change-password.dto.js';

/** Los mensajes de error del campo pedido, o [] si validó bien. */
function erroresDe(dto: object, campo: string): string[] {
  const error = validateSync(dto).find((e) => e.property === campo);
  return Object.values(error?.constraints ?? {});
}

function registroCon(password: string) {
  return erroresDe(
    plainToInstance(RegisterDto, {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@example.com',
      password,
    }),
    'password',
  );
}

describe('EsPasswordFuerte', () => {
  it('acepta una contraseña que cumple las cinco reglas', () => {
    expect(registroCon('Password123!')).toEqual([]);
  });

  it.each([
    ['corta', 'Ab1!', 'al menos 8 caracteres'],
    ['sin minúscula', 'PASSWORD123!', 'una minúscula'],
    ['sin mayúscula', 'password123!', 'una mayúscula'],
    ['sin número', 'PasswordAbc!', 'un número'],
    ['sin carácter especial', 'Password1234', 'un carácter especial'],
  ])(
    'rechaza una contraseña %s y dice qué le falta',
    (_caso, password, esperado) => {
      const errores = registroCon(password);

      expect(errores.length).toBeGreaterThan(0);
      expect(errores.join(' ')).toContain(esperado);
    },
  );

  it('rechaza por encima de 72 caracteres, que es lo que bcrypt ignora', () => {
    expect(registroCon('A1!' + 'a'.repeat(70))).toEqual([
      expect.stringContaining('72 caracteres'),
    ]);
  });

  it('señala todas las reglas incumplidas de una, no la primera', () => {
    // Importa para la UX: el usuario corrige una sola vez en vez de por rebote.
    const errores = registroCon('abcdefgh');

    expect(errores.join(' ')).toContain('mayúscula');
    expect(errores.join(' ')).toContain('número');
    expect(errores.join(' ')).toContain('carácter especial');
  });

  // Las tres rutas que aceptan una contraseña nueva tienen que pedir lo mismo:
  // si una es más floja, se entra por ahí.
  it('el reseteo valida igual que el registro', () => {
    const flojo = plainToInstance(ResetPasswordDto, {
      token: 'abc',
      password_nueva: 'password123',
    });
    const fuerte = plainToInstance(ResetPasswordDto, {
      token: 'abc',
      password_nueva: 'Password123!',
    });

    expect(erroresDe(flojo, 'password_nueva').length).toBeGreaterThan(0);
    expect(erroresDe(fuerte, 'password_nueva')).toEqual([]);
  });

  it('el cambio desde el perfil valida igual que el registro', () => {
    const flojo = plainToInstance(ChangePasswordDto, {
      password_actual: 'loQueSea',
      password_nueva: 'password123',
    });
    const fuerte = plainToInstance(ChangePasswordDto, {
      password_actual: 'loQueSea',
      password_nueva: 'Password123!',
    });

    expect(erroresDe(flojo, 'password_nueva').length).toBeGreaterThan(0);
    expect(erroresDe(fuerte, 'password_nueva')).toEqual([]);
  });

  it('la contraseña actual no se valida con las reglas nuevas', () => {
    // Las cuentas viejas tienen contraseñas que no cumplen; si validáramos
    // `password_actual` con las reglas nuevas, no podrían ni cambiarla.
    const dto = plainToInstance(ChangePasswordDto, {
      password_actual: 'vieja123',
      password_nueva: 'Password123!',
    });

    expect(erroresDe(dto, 'password_actual')).toEqual([]);
  });
});
