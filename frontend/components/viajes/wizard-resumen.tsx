'use client';

import { BedDouble, CalendarDays, MapPin, Plane, Users } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useAlojamiento, useVuelos } from '@/lib/query/use-reservas';
import { diasEntre, formatMoney, formatRango } from '@/lib/format';
import type { Viaje } from '@/lib/types/models';

/**
 * Paso 4: qué quedó armado antes de generar el itinerario. Los costos salen de
 * las opciones seleccionadas, con la misma semántica que el tab de Presupuesto:
 * `precio` del vuelo ya es el total ida+vuelta del grupo y `precioPorNoche` es
 * del grupo, así que ninguno se multiplica por `cantidadPersonas`.
 */
export function WizardResumen({
  idViaje,
  viaje,
}: {
  idViaje: number;
  viaje: Viaje;
}) {
  const vuelos = useVuelos(idViaje);
  const alojamiento = useAlojamiento(idViaje);

  const vuelo = vuelos.data?.find((v) => v.seleccionado) ?? null;
  const hotel = alojamiento.data?.find((a) => a.seleccionado) ?? null;
  const noches = diasEntre(viaje.fechaInicio, viaje.fechaFin) ?? 0;

  const costoVuelo = vuelo?.precio ?? 0;
  const costoHotel = (hotel?.precioPorNoche ?? 0) * noches;
  const total = costoVuelo + costoHotel;
  const presupuesto = viaje.presupuestoTotal;
  const cargando = vuelos.isLoading || alojamiento.isLoading;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Dato icon={<MapPin className="size-3.5" />} label="Destino">
          {viaje.destinoPrincipal}
          {viaje.origen && (
            <span className="text-muted-foreground font-normal">
              {' '}
              desde {viaje.origen}
            </span>
          )}
        </Dato>
        <Dato icon={<CalendarDays className="size-3.5" />} label="Fechas">
          {formatRango(viaje.fechaInicio, viaje.fechaFin)}
        </Dato>
        <Dato icon={<Users className="size-3.5" />} label="Personas">
          {viaje.cantidadPersonas ?? '—'}
        </Dato>
      </div>

      <div className="divide-y rounded-lg border">
        {cargando ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : (
          <>
            <Linea
              icon={<Plane className="size-4" />}
              titulo="Vuelo"
              detalle={
                vuelo
                  ? [vuelo.aerolinea, [vuelo.origen, vuelo.destino].filter(Boolean).join(' → ')]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Omitido — lo podés elegir después'
              }
              monto={vuelo ? formatMoney(costoVuelo) : null}
            />
            <Linea
              icon={<BedDouble className="size-4" />}
              titulo="Alojamiento"
              detalle={
                hotel
                  ? `${hotel.nombre ?? 'Hotel'} · ${noches} ${noches === 1 ? 'noche' : 'noches'}`
                  : 'Omitido — lo podés elegir después'
              }
              monto={hotel ? formatMoney(costoHotel) : null}
            />
            <div className="flex items-center justify-between gap-3 p-4">
              <span className="text-sm font-medium">Total estimado</span>
              <div className="text-right">
                <p className="font-semibold">{formatMoney(total)}</p>
                {presupuesto != null && (
                  <p
                    className={
                      total > presupuesto
                        ? 'text-destructive text-xs'
                        : 'text-muted-foreground text-xs'
                    }
                  >
                    {total > presupuesto
                      ? `${formatMoney(total - presupuesto)} sobre el presupuesto`
                      : `de ${formatMoney(presupuesto)}`}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-muted-foreground text-sm">
        El total todavía no incluye las actividades: eso se suma cuando generes
        el itinerario.
      </p>
    </div>
  );
}

function Linea({
  icon,
  titulo,
  detalle,
  monto,
}: {
  icon: React.ReactNode;
  titulo: string;
  detalle: string;
  monto: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{titulo}</p>
          <p className="text-muted-foreground truncate text-sm">{detalle}</p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium">{monto ?? '—'}</span>
    </div>
  );
}

function Dato({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}
