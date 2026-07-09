'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, MapPin, MapPinOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGeocodificar } from '@/lib/query/use-itinerario';
import { colorDia } from './colors';
import type { Itinerario } from '@/lib/types/models';

// Leaflet no puede renderizar en el server: cargamos el mapa solo en cliente.
const MapaItinerario = dynamic(() => import('./mapa-itinerario'), {
  ssr: false,
  loading: () => <Skeleton className="h-[520px] w-full rounded-xl" />,
});

export function MapaSection({
  itinerario,
  idViaje,
}: {
  itinerario: Itinerario;
  idViaje: number;
}) {
  const [diaSel, setDiaSel] = useState<number | null>(null);

  const actividades = itinerario.dias.flatMap((d) => d.actividades);
  const conCoords = actividades.filter(
    (a) => a.lugar.lat != null && a.lugar.lng != null,
  ).length;
  const sinCoords = actividades.length - conCoords;

  if (conCoords === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
        <MapPinOff className="text-muted-foreground size-10" />
        <div>
          <p className="font-medium">Sin ubicaciones para mostrar</p>
          <p className="text-muted-foreground text-sm">
            Las actividades de este itinerario todavía no tienen coordenadas.
          </p>
        </div>
        <GeocodeButton idViaje={idViaje} />
      </div>
    );
  }

  // Días que efectivamente tienen puntos, para los filtros.
  const diasConPuntos = itinerario.dias
    .map((d, i) => ({
      numeroDia: d.numeroDia,
      color: colorDia(i),
      tiene: d.actividades.some(
        (a) => a.lugar.lat != null && a.lugar.lng != null,
      ),
    }))
    .filter((d) => d.tiene);

  return (
    <div className="space-y-3">
      {/* Filtro por día */}
      <Select
        value={diaSel === null ? 'todos' : String(diaSel)}
        onValueChange={(v) => setDiaSel(v === 'todos' ? null : Number(v))}
      >
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los días</SelectItem>
          {diasConPuntos.map((d) => (
            <SelectItem key={d.numeroDia} value={String(d.numeroDia)}>
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                Día {d.numeroDia}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <MapaItinerario itinerario={itinerario} diaSeleccionado={diaSel} />

      {sinCoords > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            {sinCoords}{' '}
            {sinCoords === 1 ? 'actividad no tiene' : 'actividades no tienen'}{' '}
            ubicación y no {sinCoords === 1 ? 'aparece' : 'aparecen'} en el mapa.
          </p>
          <GeocodeButton idViaje={idViaje} size="sm" />
        </div>
      )}
    </div>
  );
}

function GeocodeButton({
  idViaje,
  size = 'default',
}: {
  idViaje: number;
  size?: 'default' | 'sm';
}) {
  const geocodificar = useGeocodificar(idViaje);

  function onClick() {
    geocodificar.mutate(undefined, {
      onSuccess: (r) => {
        if (r.ubicados > 0) {
          toast.success(
            `Se ubicaron ${r.ubicados} de ${r.total} ${
              r.total === 1 ? 'actividad' : 'actividades'
            }.`,
          );
        } else {
          toast.info('No se pudo ubicar ninguna actividad.');
        }
      },
      onError: () => toast.error('No se pudieron ubicar las actividades.'),
    });
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={onClick}
      disabled={geocodificar.isPending}
    >
      {geocodificar.isPending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <MapPin className="size-4" />
      )}
      {geocodificar.isPending ? 'Ubicando…' : 'Ubicar actividades faltantes'}
    </Button>
  );
}

