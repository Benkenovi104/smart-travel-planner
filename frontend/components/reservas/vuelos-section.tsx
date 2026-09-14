'use client';

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  PlaneLanding,
  PlaneTakeoff,
  Lock,
  RefreshCw,
  Ticket,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useBuscarVuelos,
  useSeleccionarVuelo,
  useVuelos,
} from '@/lib/query/use-reservas';
import { formatFecha, formatHora, formatMoney } from '@/lib/format';
import type { OpcionVuelo, TramoVuelo } from '@/lib/types/models';
import { mensajeDeError } from './opcion';
import { useMiPlan } from '@/lib/query/use-planes';
import { errorManejadoGlobal } from '@/lib/planes/errores';

/** "18h 45m" a partir de minutos. */
function formatDuracion(minutos: number | null): string | null {
  if (minutos == null || minutos <= 0) return null;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatEscalas(escalas: number | null): string | null {
  if (escalas == null) return null;
  if (escalas === 0) return 'Directo';
  return escalas === 1 ? '1 escala' : `${escalas} escalas`;
}

/**
 * Días de diferencia entre salida y llegada, para avisar cuando el vuelo aterriza
 * al día siguiente (o más). Las fechas se guardan como horario de pared en UTC,
 * así que se comparan los días UTC.
 */
function diasDeDiferencia(salida: string | null, llegada: string | null) {
  if (!salida || !llegada) return 0;
  const a = new Date(salida);
  const b = new Date(llegada);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const dia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((dia(b) - dia(a)) / 86_400_000);
}

/** Un tramo (ida o vuelta) con su aerolínea, horarios y precio propios. */
function Tramo({
  tramo,
  etiqueta,
  desde,
  hasta,
  icono,
}: {
  tramo: TramoVuelo;
  etiqueta: string;
  desde: string | null;
  hasta: string | null;
  icono: React.ReactNode;
}) {
  const horaSalida = formatHora(tramo.salida);
  const horaLlegada = formatHora(tramo.llegada);
  const duracion = formatDuracion(tramo.duracionMinutos);
  const escalas = formatEscalas(tramo.escalas);
  const cruzaDias = diasDeDiferencia(tramo.salida, tramo.llegada);

  return (
    <div className="space-y-2 rounded-xl border border-muted bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {icono}
          {etiqueta}
        </span>
        {tramo.precio != null && (
          <span className="text-sm font-semibold tabular-nums">
            {formatMoney(tramo.precio)}
          </span>
        )}
      </div>

      <p className="text-sm font-bold">{tramo.aerolinea ?? 'Aerolínea sin informar'}</p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{formatFecha(tramo.salida)}</span>
        {horaSalida && (
          <span className="tabular-nums">
            {horaSalida}
            {horaLlegada && (
              <>
                <ArrowRight className="mx-1 inline size-3 align-[-2px]" />
                {horaLlegada}
                {cruzaDias > 0 && (
                  <sup className="ml-0.5 font-semibold text-amber-500">+{cruzaDias}</sup>
                )}
              </>
            )}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {desde && hasta && (
          <span className="font-medium">
            {desde} → {hasta}
          </span>
        )}
        {escalas && (
          <Badge
            variant="secondary"
            className={
              tramo.escalas === 0
                ? 'h-5 bg-emerald-950/60 px-1.5 text-[10px] font-semibold text-emerald-300'
                : 'h-5 px-1.5 text-[10px] font-semibold'
            }
          >
            {escalas}
          </Badge>
        )}
        {duracion && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {duracion}
          </span>
        )}
      </div>
    </div>
  );
}

export function VuelosSection({ idViaje }: { idViaje: number }) {
  const { data, isLoading, isError } = useVuelos(idViaje);
  const buscar = useBuscarVuelos(idViaje);
  const seleccionar = useSeleccionarVuelo(idViaje);
  const { data: miPlan } = useMiPlan(idViaje);

  // Solo informa: el límite lo aplica el backend. Con `limite` 0 el plan no
  // incluye vuelos, y en vez del buscador se explica qué plan los habilita.
  const cupo = miPlan?.viaje?.buscarVuelos;
  const noIncluido = cupo?.limite === 0;
  const busquedasRestantes =
    cupo && cupo.limite
      ? `Búsquedas: ${Math.max(0, cupo.limite - cupo.usado)} de ${cupo.limite}`
      : null;

  function onBuscar() {
    buscar.mutate(undefined, {
      onSuccess: (opciones) =>
        opciones.length > 0
          ? toast.success(`Se encontraron ${opciones.length} opciones de vuelo.`)
          : toast.info('No se encontraron vuelos para estas fechas.'),
      onError: (e) => {
        if (errorManejadoGlobal(e)) return;
        toast.error(mensajeDeError(e, 'No se pudieron buscar vuelos'));
      },
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold">
            <PlaneTakeoff className="size-5 text-primary" />
            Vuelos
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            La ida y la vuelta se cotizan por separado y pueden ser de aerolíneas
            distintas. Los precios son el total para todo el grupo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {busquedasRestantes && (
            <span className="text-xs text-muted-foreground">
              {busquedasRestantes}
            </span>
          )}
          {/* Con vuelos ya guardados no se muestra la tarjeta del plan, pero
              hay que avisar igual por qué no hay botón para buscar de nuevo. */}
          {noIncluido && data && data.length > 0 && (
            <Link
              href="/planes"
              className="flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              <Lock className="size-3" />
              Buscar vuelos: desde el plan Base
            </Link>
          )}
          {!noIncluido && (
            <Button
              size="sm"
              onClick={onBuscar}
              disabled={buscar.isPending}
              className="gap-1.5 bg-primary text-xs hover:bg-primary/90"
            >
              <RefreshCw
                className={buscar.isPending ? 'size-3.5 animate-spin' : 'size-3.5'}
              />
              {buscar.isPending ? 'Buscando...' : 'Buscar Vuelos'}
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      )}

      {isError && (
        <p className="text-sm font-medium text-destructive">
          No se pudieron cargar los vuelos. Intentá buscar de nuevo.
        </p>
      )}

      {/* Solo cuando terminó de cargar: si no, se muestra junto a los esqueletos y
          desaparece al llegar vuelos guardados de antes. */}
      {noIncluido && !isLoading && (!data || data.length === 0) && (
        <Card className="space-y-3 border-dashed bg-muted/20 p-8 text-center">
          <Lock className="mx-auto size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              Buscar vuelos no está incluido en el plan {miPlan?.nombrePlan}
            </p>
            <p className="text-xs text-muted-foreground">
              Desde el plan Base podés buscar vuelos de ida y vuelta para cada
              viaje. Mientras tanto, podés seguir planificando sin elegir vuelo.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/planes">Ver planes</Link>
          </Button>
        </Card>
      )}

      {!noIncluido && data && data.length === 0 && !buscar.isPending && (
        <Card className="space-y-3 border-dashed bg-muted/20 p-8 text-center">
          <PlaneTakeoff className="mx-auto size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">No hay vuelos cargados</p>
            <p className="text-xs text-muted-foreground">
              Buscá las opciones de ida y vuelta para las fechas de tu viaje.
            </p>
          </div>
          <Button size="sm" onClick={onBuscar} disabled={buscar.isPending}>
            Buscar vuelos ahora
          </Button>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          {data.map((v) => (
            <Card
              key={v.id}
              className={`relative flex flex-col overflow-hidden transition-all duration-200 hover:shadow-lg ${
                v.seleccionado
                  ? 'border-2 border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-muted'
              }`}
            >
              <CardHeader className="space-y-1.5 p-4 pb-2.5">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1 text-base font-bold">
                    {v.origen ?? '—'} <span className="text-muted-foreground">⇄</span>{' '}
                    {v.destino ?? '—'}
                  </CardTitle>
                  {v.seleccionado && (
                    <Badge className="shrink-0 gap-1 bg-emerald-600 font-bold text-white shadow-md">
                      <CheckCircle2 className="size-3.5" /> Elegido
                    </Badge>
                  )}
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Ticket className="size-3.5 shrink-0 text-sky-400" />
                  {v.vuelta
                    ? 'Dos pasajes: ida y vuelta'
                    : 'Sólo ida (no se encontró vuelta)'}
                </p>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-1">
                <Tramo
                  tramo={v.ida}
                  etiqueta="Ida"
                  desde={v.origen}
                  hasta={v.destino}
                  icono={<PlaneTakeoff className="size-3.5 text-sky-400" />}
                />

                {v.vuelta && (
                  <Tramo
                    tramo={v.vuelta}
                    etiqueta="Vuelta"
                    desde={v.destino}
                    hasta={v.origen}
                    icono={<PlaneLanding className="size-3.5 text-sky-400" />}
                  />
                )}

                <div className="mt-auto space-y-3 pt-1">
                  <div className="flex items-end justify-between border-t border-muted pt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total del viaje</p>
                      {v.ida.precio != null && v.vuelta?.precio != null && (
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {formatMoney(v.ida.precio)} + {formatMoney(v.vuelta.precio)}
                        </p>
                      )}
                    </div>
                    <p className="text-xl font-bold text-primary tabular-nums">
                      {formatMoney(v.precio)}
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    variant={v.seleccionado ? 'outline' : 'default'}
                    disabled={seleccionar.isPending}
                    onClick={() => onElegir(v)}
                  >
                    {v.seleccionado ? 'Quitar del viaje' : 'Elegir vuelo'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
