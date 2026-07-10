'use client';

import { Wallet } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { usePresupuesto } from '@/lib/query/use-presupuesto';
import { ApiError } from '@/lib/api/client';
import { formatMoney } from '@/lib/format';
import type { Presupuesto, Viaje } from '@/lib/types/models';

/**
 * Categorías del desglose, en el orden en que se muestran. Los colores son los
 * mismos de la paleta del mapa (`components/mapa/colors.ts`) para que la app se
 * vea coherente, pero acá indexan categorías y no días.
 */
const CATEGORIAS = [
  { key: 'vuelos', label: 'Vuelos', color: '#2563eb' },
  { key: 'alojamiento', label: 'Alojamiento', color: '#dc2626' },
  { key: 'actividades', label: 'Actividades', color: '#16a34a' },
  { key: 'comidas', label: 'Comidas', color: '#d97706' },
  { key: 'transporteLocal', label: 'Transporte local', color: '#7c3aed' },
] as const satisfies readonly {
  key: keyof Presupuesto;
  label: string;
  color: string;
}[];

export function PresupuestoSection({
  idViaje,
  viaje,
}: {
  idViaje: number;
  viaje: Viaje;
}) {
  const { data, isLoading, isError, error } = usePresupuesto(idViaje);

  const sinPresupuesto =
    isError && error instanceof ApiError && error.status === 404;

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (sinPresupuesto) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <Wallet className="text-muted-foreground size-10" />
        <div>
          <p className="font-medium">Todavía no hay presupuesto</p>
          <p className="text-muted-foreground text-sm">
            Se calcula solo a partir del itinerario y de las opciones de vuelo y
            alojamiento que elijas.
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-destructive text-sm">
        No se pudo cargar el presupuesto.
      </p>
    );
  }

  const total = data.total ?? 0;
  const categorias = CATEGORIAS.map((c) => ({
    ...c,
    monto: (data[c.key] as number | null) ?? 0,
  })).filter((c) => c.monto > 0);

  const declarado = viaje.presupuestoTotal;
  const diferencia = declarado != null ? declarado - total : null;

  return (
    <div className="space-y-6">
      {/* Total + comparación con el presupuesto declarado del viaje */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Costo estimado
              </p>
              <p className="text-3xl font-semibold">{formatMoney(total)}</p>
            </div>
            {declarado != null && (
              <div className="text-right">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Tu presupuesto
                </p>
                <p className="text-lg font-medium">{formatMoney(declarado)}</p>
              </div>
            )}
          </div>

          {total > 0 && (
            <div
              className="bg-muted flex h-3 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={`Desglose: ${categorias
                .map((c) => `${c.label} ${formatMoney(c.monto)}`)
                .join(', ')}`}
            >
              {categorias.map((c) => (
                <div
                  key={c.key}
                  style={{
                    width: `${(c.monto / total) * 100}%`,
                    backgroundColor: c.color,
                  }}
                />
              ))}
            </div>
          )}

          {diferencia != null && (
            <p className="text-sm">
              {diferencia >= 0 ? (
                <span className="text-muted-foreground">
                  Te quedan{' '}
                  <span className="text-foreground font-medium">
                    {formatMoney(diferencia)}
                  </span>{' '}
                  de margen.
                </span>
              ) : (
                <span className="text-destructive font-medium">
                  Te pasás por {formatMoney(Math.abs(diferencia))}.
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Desglose por categoría */}
      {categorias.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categorias.map((c) => (
            <div
              key={c.key}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <span className="flex items-center gap-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.label}
              </span>
              <span className="text-sm font-medium">
                {formatMoney(c.monto)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Detalle línea por línea */}
      {data.gastos.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Detalle</h3>
          <ul className="divide-y rounded-lg border">
            {data.gastos.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-4 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{g.descripcion ?? '—'}</p>
                  {g.categoria && (
                    <p className="text-muted-foreground text-xs capitalize">
                      {g.categoria}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium">
                  {formatMoney(g.monto)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
