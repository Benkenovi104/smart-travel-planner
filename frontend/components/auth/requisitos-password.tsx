'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REQUISITOS_PASSWORD, requisitosCumplidos } from '@/lib/password';

/**
 * Lista de requisitos que se va tildando mientras se tipea.
 *
 * Existe porque las reglas de composición sin feedback son el peor de los dos
 * mundos: el usuario manda el form, le rebota un error por vez y prueba de
 * nuevo a ciegas. Mostrando los cinco desde el principio, acierta a la primera.
 *
 * Mientras el campo está vacío no se muestra nada: arrancar en rojo con cinco
 * cruces antes de que escriba una letra se lee como un error que ya cometió.
 */
export function RequisitosPassword({
  valor,
  className,
}: {
  valor: string;
  className?: string;
}) {
  if (!valor) return null;

  const cumplidos = requisitosCumplidos(valor);
  const total = REQUISITOS_PASSWORD.length;

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuenow={cumplidos}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Requisitos de la contraseña cumplidos"
      >
        {REQUISITOS_PASSWORD.map((requisito, i) => (
          <span
            key={requisito.id}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < cumplidos
                ? cumplidos === total
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
                : 'bg-slate-800',
            )}
          />
        ))}
      </div>

      <ul className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {REQUISITOS_PASSWORD.map((requisito) => {
          const ok = requisito.cumple(valor);
          return (
            <li
              key={requisito.id}
              className={cn(
                'flex items-center gap-1.5 transition-colors',
                ok ? 'text-emerald-400' : 'text-slate-400',
              )}
            >
              {ok ? (
                <Check className="h-3 w-3 shrink-0" aria-hidden />
              ) : (
                <X className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
              )}
              <span>{requisito.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
