'use client';

import { BedDouble, Star } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import {
  useAlojamiento,
  useBuscarAlojamiento,
  useSeleccionarAlojamiento,
} from '@/lib/query/use-reservas';
import { diasEntre, formatMoney } from '@/lib/format';
import type { OpcionAlojamiento, Viaje } from '@/lib/types/models';
import { Encabezado, Opcion, Vacio, mensajeDeError } from './opcion';

export function AlojamientoSection({
  idViaje,
  viaje,
}: {
  idViaje: number;
  viaje: Viaje;
}) {
  const noches = diasEntre(viaje.fechaInicio, viaje.fechaFin) ?? 0;
  const { data, isLoading, isError } = useAlojamiento(idViaje);
  const buscar = useBuscarAlojamiento(idViaje);
  const seleccionar = useSeleccionarAlojamiento(idViaje);

  function onBuscar() {
    buscar.mutate(undefined, {
      onSuccess: (opciones) =>
        opciones.length > 0
          ? toast.success(`Se encontraron ${opciones.length} alojamientos.`)
          : toast.info('No se encontró alojamiento para estas fechas.'),
      onError: (e) =>
        toast.error(mensajeDeError(e, 'No se pudo buscar alojamiento')),
    });
  }

  function onElegir(a: OpcionAlojamiento) {
    seleccionar.mutate(
      { idAlojamiento: a.id, seleccionado: !a.seleccionado },
      {
        onError: (e) =>
          toast.error(mensajeDeError(e, 'No se pudo elegir el alojamiento')),
      },
    );
  }

  return (
    <section className="space-y-3">
      <Encabezado
        icon={<BedDouble className="size-4" />}
        titulo="Alojamiento"
        descripcion={
          noches > 0
            ? `Precio por noche. El que elijas suma ${noches} ${
                noches === 1 ? 'noche' : 'noches'
              } al presupuesto.`
            : 'Precio por noche.'
        }
        pending={buscar.isPending}
        vacio={!data || data.length === 0}
        onBuscar={onBuscar}
      />

      {isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
      {isError && (
        <p className="text-destructive text-sm">
          No se pudo cargar el alojamiento.
        </p>
      )}

      {data && data.length === 0 && !buscar.isPending && (
        <Vacio texto="Todavía no buscaste alojamiento para este viaje." />
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.id}>
              <Opcion
                seleccionado={a.seleccionado}
                onElegir={() => onElegir(a)}
                pending={seleccionar.isPending}
                precio={a.precioPorNoche}
                sufijoPrecio="/ noche"
                url={a.url}
              >
                <p className="font-medium">{a.nombre ?? 'Alojamiento'}</p>
                {a.direccion && (
                  <p className="text-muted-foreground text-sm">{a.direccion}</p>
                )}
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  {a.rating != null && (
                    <span className="flex items-center gap-1">
                      <Star className="size-3 fill-current" />
                      {a.rating.toFixed(1)}
                    </span>
                  )}
                  {a.tipo && <span className="capitalize">{a.tipo}</span>}
                  {noches > 0 && a.precioPorNoche != null && (
                    <span>Total {formatMoney(a.precioPorNoche * noches)}</span>
                  )}
                </div>
              </Opcion>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
