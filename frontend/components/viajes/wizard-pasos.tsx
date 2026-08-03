import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Los 4 pasos de la creación de un viaje. El paso 1 vive en `/viajes/nuevo`
 * (crea el viaje); los pasos 2 a 4 en `/viajes/[id]/crear?paso=N`, que sólo
 * puede existir una vez que el viaje está creado porque las búsquedas de
 * vuelo y alojamiento van scopeadas a `:idViaje`.
 */
export const PASOS = [
  { numero: 1, label: 'Datos' },
  { numero: 2, label: 'Vuelos' },
  { numero: 3, label: 'Alojamiento' },
  { numero: 4, label: 'Resumen' },
] as const;

export const PRIMER_PASO = 2;
export const ULTIMO_PASO = 4;

export function WizardPasos({ actual }: { actual: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {PASOS.map((paso, i) => {
        const completado = paso.numero < actual;
        const activo = paso.numero === actual;

        return (
          <li key={paso.numero} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                activo && 'bg-primary text-primary-foreground',
                completado && 'bg-primary/15 text-primary',
                !activo && !completado && 'bg-muted text-muted-foreground',
              )}
              aria-current={activo ? 'step' : undefined}
            >
              {completado ? <Check className="size-4" /> : paso.numero}
            </div>
            <span
              className={cn(
                'hidden text-sm sm:inline',
                activo ? 'font-medium' : 'text-muted-foreground',
              )}
            >
              {paso.label}
            </span>
            {i < PASOS.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1',
                  completado ? 'bg-primary/30' : 'bg-border',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
