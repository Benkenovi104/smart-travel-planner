'use client';

import { Plane } from 'lucide-react';
import { toast } from 'sonner';

import { Skeleton } from '@/components/ui/skeleton';
import {
  useBuscarVuelos,
  useSeleccionarVuelo,
  useVuelos,
} from '@/lib/query/use-reservas';
import { formatFecha } from '@/lib/format';
import type { OpcionVuelo } from '@/lib/types/models';
import { Encabezado, Opcion, Vacio, mensajeDeError } from './opcion';

/** "1h 45m" a partir de minutos. */
function formatDuracion(minutos: number | null): string | null {
  if (minutos == null || minutos <= 0) return null;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function VuelosSection({ idViaje }: { idViaje: number }) {
  const { data, isLoading, isError } = useVuelos(idViaje);
  const buscar = useBuscarVuelos(idViaje);
  const seleccionar = useSeleccionarVuelo(idViaje);

  function onBuscar() {
    buscar.mutate(undefined, {
      onSuccess: (opciones) =>
        opciones.length > 0
          ? toast.success(`Se encontraron ${opciones.length} opciones de vuelo.`)
          : toast.info('No se encontraron vuelos para estas fechas.'),
      onError: (e) =>
        toast.error(mensajeDeError(e, 'No se pudieron buscar vuelos')),
    });
  }

  function onElegir(v: OpcionVuelo) {
    seleccionar.mutate(
      { idVuelo: v.id, seleccionado: !v.seleccionado },
      {
        onError: (e) =>
          toast.error(mensajeDeError(e, 'No se pudo elegir el vuelo')),
      },
    );
  }

  return (
    <section className="space-y-3">
      <Encabezado
        icon={<Plane className="size-4" />}
        titulo="Vuelos"
        descripcion="Precio total ida y vuelta para todo el grupo. El vuelo que elijas suma al presupuesto."
        pending={buscar.isPending}
        vacio={!data || data.length === 0}
        onBuscar={onBuscar}
      />

      {isLoading && <Skeleton className="h-24 w-full rounded-xl" />}
      {isError && (
        <p className="text-destructive text-sm">
          No se pudieron cargar los vuelos.
        </p>
      )}

      {data && data.length === 0 && !buscar.isPending && (
        <Vacio texto="Todavía no buscaste vuelos para este viaje." />
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((v) => (
            <li key={v.id}>
              <Opcion
                seleccionado={v.seleccionado}
                onElegir={() => onElegir(v)}
                pending={seleccionar.isPending}
                precio={v.precio}
                url={v.url}
              >
                <p className="font-medium">{v.aerolinea ?? 'Vuelo'}</p>
                <p className="text-muted-foreground text-sm">
                  {v.origen} → {v.destino}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatFecha(v.fechaSalida)}
                  {v.fechaRegreso && ` · vuelta ${formatFecha(v.fechaRegreso)}`}
                  {formatDuracion(v.duracionTotal) &&
                    ` · ${formatDuracion(v.duracionTotal)} en vuelo`}
                </p>
              </Opcion>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
