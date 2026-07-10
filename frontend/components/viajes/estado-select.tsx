'use client';

import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EstadoBadge, ESTADOS_VIAJE, ESTADO_MAP } from './estado-badge';
import { useActualizarViaje } from '@/lib/query/use-viajes';
import { ApiError } from '@/lib/api/client';
import type { EstadoViaje } from '@/lib/types/models';

/** El badge del estado, pero clickeable: cambia el estado con un PATCH. */
export function EstadoSelect({
  idViaje,
  estado,
}: {
  idViaje: number;
  estado: EstadoViaje | null;
}) {
  const actualizar = useActualizarViaje(idViaje);

  function cambiar(nuevo: EstadoViaje) {
    if (nuevo === estado) return;
    actualizar.mutate(
      { estado: nuevo },
      {
        onSuccess: () =>
          toast.success(`Viaje marcado como ${ESTADO_MAP[nuevo].label.toLowerCase()}`),
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : 'No se pudo cambiar el estado',
          ),
      },
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={actualizar.isPending}>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto gap-1 px-1 py-0"
          aria-label="Cambiar el estado del viaje"
        >
          <EstadoBadge estado={estado} />
          {actualizar.isPending ? (
            <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
          ) : (
            <ChevronDown className="text-muted-foreground size-3.5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ESTADOS_VIAJE.map((e) => (
          <DropdownMenuItem key={e} onSelect={() => cambiar(e)}>
            <Check
              className={e === estado ? 'size-4 opacity-100' : 'size-4 opacity-0'}
            />
            {ESTADO_MAP[e].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
