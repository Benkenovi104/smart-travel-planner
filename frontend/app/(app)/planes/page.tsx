'use client';

import { Check, Crown, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MedidorUso } from '@/components/planes/medidor-uso';
import { useCatalogoPlanes, useMiPlan } from '@/lib/query/use-planes';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LimitesPlan } from '@/lib/types/models';

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

export default function PlanesPage() {
  const catalogo = useCatalogoPlanes();
  const { data: miPlan } = useMiPlan();

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
            {catalogo.data.planes.map((p) => {
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
                        : p.precioMensualArs === null
                          ? 'Precio a definir'
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
                    {!actual && p.plan !== 'GRATIS' && (
                      <Button className="mt-auto w-full" disabled>
                        Próximamente
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">
            Los planes pagos se van a poder contratar con Mercado Pago. Además,
            todos los planes tienen un tope de seguridad de{' '}
            {catalogo.data.topeDiario.itinerario} generaciones de itinerario y{' '}
            {catalogo.data.topeDiario.busquedas} búsquedas por día.
          </p>
        </>
      )}
    </div>
  );
}
