'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VuelosSection } from '@/components/reservas/vuelos-section';
import { AlojamientoSection } from '@/components/reservas/alojamiento-section';
import {
  WizardPasos,
  PRIMER_PASO,
  ULTIMO_PASO,
} from '@/components/viajes/wizard-pasos';
import { WizardResumen } from '@/components/viajes/wizard-resumen';
import { useViaje, useActualizarViaje } from '@/lib/query/use-viajes';
import { useGenerarItinerario } from '@/lib/query/use-itinerario';
import { ApiError } from '@/lib/api/client';

const COPY: Record<number, { titulo: string; descripcion: string }> = {
  2: {
    titulo: '¿Cómo viajás?',
    descripcion:
      'Buscá y elegí un vuelo. Si todavía no lo tenés decidido, podés omitir este paso y elegirlo más adelante.',
  },
  3: {
    titulo: '¿Dónde te quedás?',
    descripcion:
      'Buscá y elegí un alojamiento. También podés omitirlo y resolverlo después.',
  },
  4: {
    titulo: 'Todo listo',
    descripcion:
      'Revisá cómo quedó el viaje. Cuando generes el itinerario, la IA arma un plan día por día con tus intereses.',
  },
};

export default function CrearViajeWizardPage() {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <Wizard />
    </Suspense>
  );
}

function Wizard() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: viaje, isLoading, isError } = useViaje(id);
  const actualizar = useActualizarViaje(id);
  const generar = useGenerarItinerario(id);

  const pedido = Number(searchParams.get('paso'));
  const paso = Number.isFinite(pedido)
    ? Math.min(Math.max(pedido, PRIMER_PASO), ULTIMO_PASO)
    : PRIMER_PASO;

  // Un viaje que ya salió del wizard no vuelve a entrar: para cambiar vuelo o
  // alojamiento están los tabs del detalle.
  const yaTerminado = viaje != null && viaje.estado !== 'borrador';
  useEffect(() => {
    if (yaTerminado) router.replace(`/viajes/${id}`);
  }, [yaTerminado, id, router]);

  function irAPaso(n: number) {
    router.push(`/viajes/${id}/crear?paso=${n}`);
  }

  /** Saca el viaje del estado borrador y cae en el detalle de siempre. */
  function terminar() {
    actualizar.mutate(
      { estado: 'planificado' },
      {
        onSuccess: () => router.replace(`/viajes/${id}`),
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : 'No se pudo terminar el viaje',
          ),
      },
    );
  }

  function generarYTerminar() {
    generar.mutate(undefined, {
      onSuccess: () => {
        toast.success('Itinerario generado');
        terminar();
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : 'No se pudo generar el itinerario',
        ),
    });
  }

  if (isLoading || yaTerminado) return <WizardSkeleton />;

  if (isError || !viaje) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <p className="text-muted-foreground">No se pudo cargar el viaje.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Volver al inicio</Link>
        </Button>
      </div>
    );
  }

  const copy = COPY[paso];
  const cerrando = actualizar.isPending || generar.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <p className="text-muted-foreground truncate text-sm">
          {viaje.destinoPrincipal}
        </p>
      </div>

      <WizardPasos actual={paso} />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{copy.titulo}</CardTitle>
          <CardDescription>{copy.descripcion}</CardDescription>
        </CardHeader>
        <CardContent>
          {paso === 2 && <VuelosSection idViaje={id} />}
          {paso === 3 && <AlojamientoSection idViaje={id} viaje={viaje} />}
          {paso === 4 && <WizardResumen idViaje={id} viaje={viaje} />}
        </CardContent>

        <div className="flex flex-wrap items-center justify-between gap-3 p-6 pt-0">
          <Button
            variant="ghost"
            onClick={() => irAPaso(paso - 1)}
            disabled={paso === PRIMER_PASO || cerrando}
          >
            <ArrowLeft className="size-4" />
            Atrás
          </Button>

          {paso < ULTIMO_PASO ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => irAPaso(paso + 1)}>
                Omitir por ahora
              </Button>
              <Button onClick={() => irAPaso(paso + 1)}>
                Siguiente
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={terminar} disabled={cerrando}>
                {actualizar.isPending && !generar.isPending && (
                  <Loader2 className="animate-spin" />
                )}
                Terminar por ahora
              </Button>
              <Button onClick={generarYTerminar} disabled={cerrando}>
                {generar.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {generar.isPending ? 'Generando…' : 'Generar itinerario'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {generar.isPending && (
        <p className="text-muted-foreground text-center text-sm">
          Esto puede tardar cerca de un minuto. No cierres la pestaña.
        </p>
      )}
    </div>
  );
}

function WizardSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-7 w-full rounded-full" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
