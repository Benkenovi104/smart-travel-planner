'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  CalendarSearch,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EstadoBadge } from '@/components/viajes/estado-badge';
import { EditableItinerario } from '@/components/itinerario/editable-itinerario';
import { HistorialCambios } from '@/components/itinerario/historial-cambios';
import { MapaSection } from '@/components/mapa/mapa-section';
import { PresupuestoSection } from '@/components/presupuesto/presupuesto-section';
import { VuelosSection } from '@/components/reservas/vuelos-section';
import { AlojamientoSection } from '@/components/reservas/alojamiento-section';
import { useViaje, useEliminarViaje } from '@/lib/query/use-viajes';
import { useItinerario, useGenerarItinerario } from '@/lib/query/use-itinerario';
import { ApiError } from '@/lib/api/client';
import { formatFecha, formatMoney, formatRango } from '@/lib/format';

export default function ViajeDetallePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();

  const { data: viaje, isLoading, isError } = useViaje(id);
  const itinerario = useItinerario(id);
  const generar = useGenerarItinerario(id);
  const eliminar = useEliminarViaje();

  const [tab, setTab] = useState('itinerario');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  function toggleCollapse(idDia: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(idDia)) next.delete(idDia);
      else next.add(idDia);
      return next;
    });
  }

  function irADia(idDia: number) {
    setTab('itinerario');
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(idDia); // asegurar que el día quede expandido
      return next;
    });
    // Esperar a que el tab/día se rendericen antes de hacer scroll.
    setTimeout(() => {
      document
        .getElementById(`dia-${idDia}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  const sinItinerario =
    itinerario.isError &&
    itinerario.error instanceof ApiError &&
    itinerario.error.status === 404;

  function onGenerar() {
    generar.mutate(undefined, {
      onSuccess: () => toast.success('Itinerario generado'),
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : 'No se pudo generar el itinerario',
        ),
    });
  }

  function onEliminar() {
    eliminar.mutate(id, {
      onSuccess: () => {
        toast.success('Viaje eliminado');
        router.replace('/dashboard');
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : 'No se pudo eliminar el viaje',
        ),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !viaje) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <p className="text-destructive text-sm">
          No se pudo cargar el viaje. Puede que no exista o no tengas acceso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </Button>

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{viaje.destinoPrincipal}</h1>
            <EstadoBadge estado={viaje.estado} />
          </div>
          <p className="text-muted-foreground text-sm">desde {viaje.origen}</p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar este viaje?</DialogTitle>
              <DialogDescription>
                Se borrará el viaje junto con su itinerario. Esta acción no se
                puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={onEliminar}
                disabled={eliminar.isPending}
              >
                {eliminar.isPending && <Loader2 className="animate-spin" />}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen */}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato icon={<CalendarDays className="size-4" />} label="Fechas">
            {formatRango(viaje.fechaInicio, viaje.fechaFin)}
          </Dato>
          <Dato icon={<Users className="size-4" />} label="Personas">
            {viaje.cantidadPersonas ?? 1}
          </Dato>
          <Dato icon={<Wallet className="size-4" />} label="Presupuesto">
            {formatMoney(viaje.presupuestoTotal)}
          </Dato>
          <Dato icon={<MapPin className="size-4" />} label="Origen">
            {viaje.origen}
          </Dato>
          {viaje.intereses.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                Intereses
              </p>
              <div className="flex flex-wrap gap-2">
                {viaje.intereses.map((i) => (
                  <Badge key={i.id} variant="secondary" className="capitalize">
                    {i.nombre}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Presupuesto, vuelos y alojamiento no dependen del itinerario, así que
          los tabs se muestran siempre y cada uno resuelve su propio estado vacío. */}
      <Tabs value={tab} onValueChange={setTab}>
        {/* Cinco tabs no entran en un teléfono: la barra scrollea en vez de
            comprimir las etiquetas hasta hacerlas ilegibles. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="itinerario">Itinerario</TabsTrigger>
            <TabsTrigger value="mapa">Mapa</TabsTrigger>
            <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
            <TabsTrigger value="vuelos">Vuelos</TabsTrigger>
            <TabsTrigger value="alojamiento">Alojamiento</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="itinerario" className="space-y-3 pt-4">
          {itinerario.data && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">
                Arrastrá las actividades para reordenarlas o moverlas de día.
              </p>
              <div className="flex items-center gap-1">
                <HistorialCambios idViaje={id} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <CalendarSearch className="size-4" />
                      Ir a día
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="max-h-80 overflow-y-auto"
                  >
                    {itinerario.data.dias.map((d) => (
                      <DropdownMenuItem key={d.id} onSelect={() => irADia(d.id)}>
                        Día {d.numeroDia} · {formatFecha(d.fecha)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <RegenerarButton
                  pending={generar.isPending}
                  onConfirm={onGenerar}
                />
              </div>
            </div>
          )}

          {itinerario.isLoading && (
            <Skeleton className="h-48 w-full rounded-xl" />
          )}

          {sinItinerario && <GenerarItinerarioCTA onGenerar={onGenerar} pending={generar.isPending} />}

          {itinerario.isError && !sinItinerario && (
            <p className="text-destructive text-sm">
              No se pudo cargar el itinerario.
            </p>
          )}

          {itinerario.data && (
            <EditableItinerario
              itinerario={itinerario.data}
              idViaje={id}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
            />
          )}
        </TabsContent>

        <TabsContent value="mapa" className="pt-4">
          {itinerario.data ? (
            <MapaSection itinerario={itinerario.data} idViaje={id} />
          ) : sinItinerario ? (
            <GenerarItinerarioCTA
              onGenerar={onGenerar}
              pending={generar.isPending}
              texto="El mapa se arma con las actividades del itinerario."
            />
          ) : (
            <Skeleton className="h-[520px] w-full rounded-xl" />
          )}
        </TabsContent>

        <TabsContent value="presupuesto" className="pt-4">
          <PresupuestoSection idViaje={id} viaje={viaje} />
        </TabsContent>

        <TabsContent value="vuelos" className="pt-4">
          <VuelosSection idViaje={id} />
        </TabsContent>

        <TabsContent value="alojamiento" className="pt-4">
          <AlojamientoSection idViaje={id} viaje={viaje} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GenerarItinerarioCTA({
  onGenerar,
  pending,
  texto = 'La IA arma un plan día por día según tu destino, fechas e intereses.',
}: {
  onGenerar: () => void;
  pending: boolean;
  texto?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
      <Sparkles className="text-muted-foreground size-10" />
      <div>
        <p className="font-medium">Todavía no generaste el itinerario</p>
        <p className="text-muted-foreground text-sm">{texto}</p>
      </div>
      <Button onClick={onGenerar} disabled={pending}>
        {pending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {pending ? 'Generando…' : 'Generar itinerario'}
      </Button>
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

function RegenerarButton({
  pending,
  onConfirm,
}: {
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Regenerar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Regenerar el itinerario?</DialogTitle>
          <DialogDescription>
            Se reemplazará el itinerario actual por uno nuevo. Se perderán las
            ediciones manuales que hayas hecho.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={onConfirm}>Regenerar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
