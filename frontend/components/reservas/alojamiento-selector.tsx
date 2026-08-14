'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  BedDouble,
  Star,
  ExternalLink,
  MapPin,
  Sparkles,
  CheckCircle2,
  Building2,
  RefreshCw,
  Map,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAlojamiento,
  useBuscarAlojamiento,
  useSeleccionarAlojamiento,
} from '@/lib/query/use-reservas';
import { diasEntre, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { OpcionAlojamiento, Viaje } from '@/lib/types/models';
import { mensajeDeError } from './opcion';

// Mapa Leaflet importado dinámicamente sin SSR
const MapaItinerario = dynamic(() => import('@/components/mapa/mapa-itinerario'), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
});

function HotelImageCarousel({
  fotos,
  fotoUrl,
  nombre,
}: {
  fotos?: string[];
  fotoUrl?: string;
  nombre: string | null;
}) {
  const list = fotos && fotos.length > 0 ? fotos : fotoUrl ? [fotoUrl] : [];
  const [index, setIndex] = useState(0);

  if (list.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center bg-linear-to-br from-slate-800 to-slate-900 text-slate-400">
        <Building2 className="size-12 opacity-40" />
      </div>
    );
  }

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIndex((curr) => (curr === 0 ? list.length - 1 : curr - 1));
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIndex((curr) => (curr === list.length - 1 ? 0 : curr + 1));
  };

  return (
    <div className="relative h-48 w-full overflow-hidden bg-muted group/carousel">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={list[index]}
        alt={nombre ?? 'Hotel'}
        className="h-full w-full object-cover transition-all duration-300 hover:scale-105"
      />

      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white opacity-80 hover:opacity-100 transition-opacity shadow-md"
            title="Imagen anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white opacity-80 hover:opacity-100 transition-opacity shadow-md"
            title="Siguiente imagen"
          >
            <ChevronRight className="size-4" />
          </button>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-full">
            {list.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'size-1.5 rounded-full transition-all',
                  i === index ? 'bg-white w-3' : 'bg-white/50',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AlojamientoSelector({
  idViaje,
  viaje,
  onSkip,
}: {
  idViaje: number;
  viaje: Viaje;
  onSkip?: () => void;
}) {
  const noches = Math.max(1, diasEntre(viaje.fechaInicio, viaje.fechaFin) ?? 1);
  const { data: alojamientos, isLoading, isError } = useAlojamiento(idViaje);
  const buscar = useBuscarAlojamiento(idViaje);
  const seleccionar = useSeleccionarAlojamiento(idViaje);
  const [alojamientoDetalle, setAlojamientoDetalle] = useState<OpcionAlojamiento | null>(null);
  const [autoBuscado, setAutoBuscado] = useState<boolean>(false);

  useEffect(() => {
    if (isLoading || buscar.isPending || autoBuscado || !alojamientos) return;

    // Auto-buscar si está vacío o si contiene opciones de prueba antiguas
    const requiereBusqueda =
      alojamientos.length === 0 ||
      alojamientos.some(
        (a) => !a.fotoUrl && (a.nombre?.includes('Aristides') || a.nombre?.includes('Mendoza')),
      );

    if (requiereBusqueda) {
      setAutoBuscado(true);
      buscar.mutate(undefined, {
        onError: () => {},
      });
    }
  }, [alojamientos, isLoading, buscar, autoBuscado]);

  function onBuscar() {
    buscar.mutate(undefined, {
      onSuccess: (opciones) =>
        opciones.length > 0
          ? toast.success(`Se encontraron ${opciones.length} alojamientos enriquecidos.`)
          : toast.info('No se encontraron alojamientos para este destino.'),
      onError: (e) =>
        toast.error(mensajeDeError(e, 'No se pudo buscar alojamientos con Google Places')),
    });
  }

  function onElegir(a: OpcionAlojamiento) {
    seleccionar.mutate(
      { idAlojamiento: a.id, seleccionado: !a.seleccionado },
      {
        onSuccess: () => {
          if (!a.seleccionado) {
            toast.success(`"${a.nombre}" seleccionado para tu presupuesto.`);
          }
        },
        onError: (e) => toast.error(mensajeDeError(e, 'No se pudo seleccionar el alojamiento')),
      },
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Botón de búsqueda */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <BedDouble className="size-5 text-primary" />
            Hospedaje Recomendado por IA
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Opciones reales con fotos, ubicación y recomendaciones personalizadas para {noches} {noches === 1 ? 'noche' : 'noches'}.
          </p>
        </div>

        <div className="flex gap-2">
          {onSkip && (
            <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs">
              Omitir por ahora
            </Button>
          )}
          <Button
            size="sm"
            onClick={onBuscar}
            disabled={buscar.isPending}
            className="gap-1.5 text-xs bg-primary hover:bg-primary/90"
          >
            <RefreshCw className={buscar.isPending ? 'size-3.5 animate-spin' : 'size-3.5'} />
            {buscar.isPending ? 'Buscando...' : 'Buscar Alojamientos'}
          </Button>
        </div>
      </div>

      {/* Estados de Carga / Error / Vacío */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive font-medium">
          No se pudieron obtener las opciones de alojamiento. Intentá buscar de nuevo.
        </p>
      )}

      {alojamientos && alojamientos.length === 0 && !buscar.isPending && (
        <Card className="border-dashed p-8 text-center space-y-3 bg-muted/20">
          <Building2 className="mx-auto size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">No hay alojamientos cargados</p>
            <p className="text-xs text-muted-foreground">
              Hacé clic en &quot;Buscar Alojamientos&quot; para obtener opciones personalizadas con fotos y recomendaciones de IA.
            </p>
          </div>
          <Button size="sm" onClick={onBuscar} disabled={buscar.isPending}>
            Buscar ahora con Google Places
          </Button>
        </Card>
      )}

      {/* Grid de Tarjetas Reordenadas */}
      {alojamientos && alojamientos.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          {alojamientos.map((a) => {
            const costoTotal = a.precioPorNoche != null ? a.precioPorNoche * noches : null;

            return (
              <Card
                key={a.id}
                className={`relative flex flex-col overflow-hidden transition-all duration-200 hover:shadow-lg ${
                  a.seleccionado
                    ? 'border-2 border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-muted'
                }`}
              >
                {/* 1. ARRIBA: Nombre, Badge de IA con Tooltip y Dirección */}
                <CardHeader className="p-4 pb-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-bold line-clamp-1">
                      {a.nombre ?? 'Alojamiento Recomendado'}
                    </CardTitle>

                    {/* Badge de IA compacto con Tooltip al pasar el mouse */}
                    {a.razonRecomendacion && (
                      <div className="group/ai relative shrink-0">
                        <Badge className="bg-purple-950/80 hover:bg-purple-900 text-purple-200 border-purple-500/40 text-[11px] font-semibold gap-1 cursor-help py-0.5 px-2 shadow-xs transition-all">
                          <Sparkles className="size-3 text-purple-400 animate-pulse" />
                          IA ✨
                        </Badge>

                        {/* Tooltip flotante al pasar el mouse */}
                        <div className="pointer-events-none absolute right-0 top-full mt-2 w-64 opacity-0 group-hover/ai:opacity-100 transition-all duration-200 z-30">
                          <div className="rounded-xl bg-slate-950 border border-purple-500/40 p-3 shadow-2xl text-xs text-purple-100 leading-relaxed font-medium">
                            <div className="flex items-center gap-1.5 text-purple-300 font-semibold mb-1">
                              <Sparkles className="size-3.5 text-purple-400" />
                              Recomendación IA:
                            </div>
                            {a.razonRecomendacion}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {a.direccion && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1">
                      <MapPin className="size-3.5 shrink-0 text-sky-400" />
                      {a.direccion}
                    </p>
                  )}
                </CardHeader>


                {/* 3. IMÁGENES: Carrusel Deslizable */}
                <div className="relative">
                  <HotelImageCarousel fotos={a.fotos} fotoUrl={a.fotoUrl} nombre={a.nombre} />

                  {/* Badge Seleccionado Overlay */}
                  {a.seleccionado && (
                    <div className="absolute top-3 left-3 z-10">
                      <Badge className="bg-emerald-600 text-white font-bold gap-1 shadow-md">
                        <CheckCircle2 className="size-3.5" /> Seleccionado
                      </Badge>
                    </div>
                  )}

                  {/* Badge Rating Overlay */}
                  {a.rating != null && (
                    <div className="absolute top-3 right-3 z-10">
                      <Badge variant="secondary" className="gap-1 bg-background/90 backdrop-blur shadow-sm text-xs font-semibold">
                        <Star className="size-3 text-amber-500 fill-amber-500" />
                        {a.rating.toFixed(1)}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* 4. ABAJO: Precio, Sitio Web, Mapa y Elegir Hospedaje */}
                <CardContent className="p-4 pt-3 flex-1 space-y-3">
                  <div className="flex items-baseline justify-between pt-1 border-t text-xs">
                    <span className="text-muted-foreground font-medium">Precio estimado:</span>
                    <div className="text-right">
                      <span className="text-base font-bold text-primary">
                        {a.precioPorNoche != null ? formatMoney(a.precioPorNoche) : 'Consultar'}
                      </span>
                      <span className="text-muted-foreground text-xs"> / noche</span>
                      {costoTotal != null && (
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Total ({noches} {noches === 1 ? 'noche' : 'noches'}): {formatMoney(costoTotal)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0 flex flex-wrap gap-2 justify-between border-t border-muted/30 pt-3">
                  <div className="flex gap-2">
                    {/* Botón Sitio Web Oficial */}
                    {a.url && (
                      <Button variant="outline" size="sm" asChild className="text-xs gap-1">
                        <a href={a.url} target="_blank" rel="noopener noreferrer">
                          Sitio Web <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    )}

                    {/* Botón Mapa (anteriormente "Detalles") */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAlojamientoDetalle(a)}
                          className="text-xs gap-1"
                        >
                          <Map className="size-3.5" /> Mapa
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Building2 className="size-5 text-primary" />
                            {alojamientoDetalle?.nombre}
                          </DialogTitle>
                          <DialogDescription>
                            {alojamientoDetalle?.direccion}
                          </DialogDescription>
                        </DialogHeader>

                        {alojamientoDetalle && (
                          <div className="space-y-4 pt-2">
                            {alojamientoDetalle.razonRecomendacion && (
                              <div className="rounded-xl bg-purple-950/40 p-3 flex gap-2 border border-purple-500/30">
                                <Sparkles className="size-5 text-purple-400 shrink-0" />
                                <p className="text-xs text-purple-100">
                                  <strong>¿Por qué lo eligió la IA?:</strong>{' '}
                                  {alojamientoDetalle.razonRecomendacion}
                                </p>
                              </div>
                            )}

                            {/* Mapa de Ubicación si hay coordenadas */}
                            {alojamientoDetalle.lat != null && alojamientoDetalle.lng != null ? (
                              <div className="overflow-hidden rounded-xl border">
                                <MapaItinerario
                                  itinerario={{ id: 0, idViaje: idViaje, fechaGeneracion: null, tipoGeneracion: null, dias: [] }}
                                  hotel={alojamientoDetalle}
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                Coordenadas de mapa no disponibles.
                              </p>
                            )}

                            <div className="flex justify-between items-center pt-2">
                              <span className="text-sm font-semibold">
                                {alojamientoDetalle.precioPorNoche != null
                                  ? `${formatMoney(alojamientoDetalle.precioPorNoche)} / noche`
                                  : 'Consultar precio'}
                              </span>
                              {alojamientoDetalle.url && (
                                <Button size="sm" asChild variant="outline" className="gap-1">
                                  <a href={alojamientoDetalle.url} target="_blank" rel="noopener noreferrer">
                                    Ir al sitio oficial <ExternalLink className="size-3.5" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Botón Principal: Elegir */}
                  <Button
                    size="sm"
                    variant={a.seleccionado ? 'secondary' : 'default'}
                    onClick={() => onElegir(a)}
                    disabled={seleccionar.isPending}
                    className="text-xs font-semibold"
                  >
                    {a.seleccionado ? 'Quitar selección' : 'Elegir hospedaje'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
