'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { Check, Crown, Loader2, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MedidorUso } from '@/components/planes/medidor-uso';
import {
  useCatalogoPlanes,
  useMiPlan,
  useSuscribirPlan,
} from '@/lib/query/use-planes';
import { guardarSuscripcionEnCurso } from '@/lib/planes/checkout';
import { ApiError } from '@/lib/api/client';
import { formatFecha, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LimitesPlan, MiPlan, Plan, PlanPago } from '@/lib/types/models';

/** `true` = incluido sin límite, `false` = no incluido, texto = con límite. */
type Valor = boolean | string;

function porViaje(n: number | null): Valor {
  if (n === null) return 'Sin límite';
  if (n === 0) return false;
  return `${n} por viaje`;
}

// Las filas salen de los límites que manda el backend: acá no hay ningún número
// escrito, así que cambiar un límite en el backend alcanza.
const FILAS: { etiqueta: string; valor: (l: LimitesPlan) => Valor }[] = [
  {
    etiqueta: 'Viajes por período',
    valor: (l) =>
      l.viajesPorPeriodo === null ? 'Sin límite' : String(l.viajesPorPeriodo),
  },
  {
    etiqueta: 'Generar itinerario con IA',
    valor: (l) =>
      l.generarPorViaje === null
        ? true
        : `${l.generarPorViaje} ${l.generarPorViaje === 1 ? 'vez' : 'veces'} por viaje`,
  },
  { etiqueta: 'Regenerar itinerario', valor: (l) => porViaje(l.regenerarPorViaje) },
  { etiqueta: 'Editar, mapa y presupuesto', valor: () => true },
  { etiqueta: 'Optimizar recorrido', valor: (l) => l.optimizar },
  { etiqueta: 'Buscar alojamiento', valor: (l) => porViaje(l.alojamientoPorViaje) },
  { etiqueta: 'Buscar vuelos', valor: (l) => porViaje(l.vuelosPorViaje) },
];

function Celda({ valor }: { valor: Valor }) {
  if (valor === true) return <Check className="size-4 text-emerald-400" />;
  if (valor === false) return <Minus className="text-muted-foreground size-4" />;
  return <span className="text-sm font-medium">{valor}</span>;
}

/**
 * El botón de cada plan. Solo orienta: si el backend no permite la suscripción
 * (por ejemplo, bajar mientras se cobra un plan mayor), responde con el motivo.
 */
function AccionPlan({
  plan,
  nombre,
  indice,
  indiceActual,
  miPlan,
  ocupado,
  yendo,
  onSuscribir,
}: {
  plan: Plan;
  nombre: string;
  indice: number;
  indiceActual: number;
  miPlan: MiPlan;
  ocupado: boolean;
  yendo: boolean;
  onSuscribir: (plan: PlanPago) => void;
}) {
  if (plan === 'GRATIS') return null;

  const cancelada = miPlan.estado === 'CANCELADA';
  const esElActual = indice === indiceActual;
  if (esElActual && !cancelada) return null;

  // Un plan pago que Mercado Pago sigue cobrando: para bajar, primero se cancela.
  const cobrandoOtro =
    miPlan.plan !== 'GRATIS' && miPlan.vigenteHasta !== null && !cancelada;
  if (indice < indiceActual && cobrandoOtro) {
    return (
      <div className="mt-auto space-y-2">
        <Button className="w-full" variant="outline" disabled>
          Primero cancelá tu plan
        </Button>
        <p className="text-xs text-muted-foreground">
          Cancelalo desde{' '}
          <Link href="/perfil#mi-plan" className="underline hover:text-white">
            tu perfil
          </Link>
          : lo conservás hasta el {formatFecha(miPlan.vigenteHasta)}.
        </p>
      </div>
    );
  }

  const texto = esElActual
    ? 'Volver a suscribirme'
    : miPlan.plan === 'GRATIS' || cancelada
      ? 'Suscribirme'
      : `Pasar a ${nombre}`;

  return (
    <Button
      className="mt-auto w-full"
      disabled={ocupado}
      onClick={() => onSuscribir(plan)}
    >
      {yendo ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Yendo a Mercado Pago…
        </>
      ) : (
        texto
      )}
    </Button>
  );
}

export default function PlanesPage() {
  const catalogo = useCatalogoPlanes();
  const { data: miPlan } = useMiPlan();
  const suscribir = useSuscribirPlan();

  function onSuscribir(plan: PlanPago) {
    suscribir.mutate(plan, {
      onSuccess: ({ idSuscripcion, initPoint }) => {
        guardarSuscripcionEnCurso(idSuscripcion);
        // El pago se hace en Mercado Pago, que después vuelve a /planes/resultado.
        window.location.href = initPoint;
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError
            ? e.message
            : 'No pudimos iniciar el pago. Probá de nuevo.',
        ),
    });
  }

  // Después del éxito sigue ocupado: la página se está yendo a Mercado Pago.
  const ocupado = suscribir.isPending || suscribir.isSuccess;
  const indiceActual =
    miPlan && catalogo.data
      ? catalogo.data.planes.findIndex((p) => p.plan === miPlan.plan)
      : -1;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-white">
          <Crown className="size-7 text-violet-300" />
          Planes
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Todos los planes incluyen editar tus itinerarios, el mapa y el
          presupuesto. Lo que cambia es cuántas veces podés usar la IA y las
          búsquedas de vuelos y alojamiento.
        </p>
      </div>

      <MedidorUso />

      {catalogo.isLoading && (
        <div className="grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {catalogo.isError && (
        <p className="text-sm text-destructive">
          No se pudieron cargar los planes. Reintentá en unos segundos.
        </p>
      )}

      {catalogo.data && (
        <>
          <div className="grid gap-6 sm:grid-cols-3">
            {catalogo.data.planes.map((p, indice) => {
              const actual = miPlan?.plan === p.plan;
              return (
                <Card
                  key={p.plan}
                  className={cn(
                    'flex flex-col',
                    actual && 'border-2 border-primary ring-2 ring-primary/20',
                  )}
                >
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xl font-bold">
                        {p.nombre}
                      </CardTitle>
                      {actual && <Badge>Tu plan</Badge>}
                    </div>
                    <p className="text-2xl font-extrabold">
                      {/* El nombre ya dice "Gratis": repetirlo como precio se lee raro. */}
                      {p.precioMensualArs === 0
                        ? '$ 0 / mes'
                        : `${formatMoney(p.precioMensualArs)} / mes`}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <ul className="divide-y divide-slate-800">
                      {FILAS.map((fila) => (
                        <li
                          key={fila.etiqueta}
                          className="flex items-center justify-between gap-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {fila.etiqueta}
                          </span>
                          <Celda valor={fila.valor(p.limites)} />
                        </li>
                      ))}
                    </ul>
                    {miPlan && (
                      <AccionPlan
                        plan={p.plan}
                        nombre={p.nombre}
                        indice={indice}
                        indiceActual={indiceActual}
                        miPlan={miPlan}
                        ocupado={ocupado}
                        yendo={ocupado && suscribir.variables === p.plan}
                        onSuscribir={onSuscribir}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">
            Los planes pagos se cobran todos los meses con Mercado Pago, en
            pesos, desde el día en que pagás. Podés cancelar cuando quieras desde
            tu perfil y conservás el plan hasta el fin del período pagado. Todos
            los planes tienen además un tope de seguridad de{' '}
            {catalogo.data.topeDiario.itinerario} generaciones de itinerario y{' '}
            {catalogo.data.topeDiario.busquedas} búsquedas por día.
          </p>
        </>
      )}
    </div>
  );
}
