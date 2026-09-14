'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { useMiPlan } from '@/lib/query/use-planes';
import { formatFecha } from '@/lib/format';

/** Plan actual y cuántos viajes del período lleva usados. */
export function MedidorUso() {
  const { data } = useMiPlan();
  if (!data) return null;

  const { usado, limite } = data.viajes;
  const agotado = limite !== null && usado >= limite;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <Crown className="size-4 text-violet-300" />
            Plan {data.nombrePlan}
          </span>
          <span className={agotado ? 'text-amber-400' : 'text-slate-400'}>
            {limite === null
              ? 'Viajes ilimitados'
              : `${usado} de ${limite} ${limite === 1 ? 'viaje' : 'viajes'} en este período`}
          </span>
          {limite !== null && (
            <span className="text-xs text-slate-500">
              · se renueva el {formatFecha(data.periodoHasta)}
            </span>
          )}
        </div>

        {limite !== null && (
          <Progress
            value={Math.min(100, (usado / limite) * 100)}
            className="h-1.5"
          />
        )}

        {data.estado === 'EN_GRACIA' && (
          <p className="text-xs text-amber-400">
            No pudimos cobrar la renovación. Regularizá el pago para no perder
            el plan.
          </p>
        )}
      </div>

      {data.plan !== 'PREMIUM' && (
        <Link
          href="/planes"
          className="shrink-0 text-xs font-semibold text-sky-400 hover:text-sky-300"
        >
          {agotado ? 'Mejorar plan' : 'Ver planes'}
        </Link>
      )}
    </div>
  );
}
