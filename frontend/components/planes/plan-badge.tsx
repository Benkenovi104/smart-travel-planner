'use client';

import Link from 'next/link';
import { Crown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMiPlan } from '@/lib/query/use-planes';

export function PlanBadge() {
  const { data } = useMiPlan();
  if (!data) return null;

  const enGracia = data.estado === 'EN_GRACIA';
  const texto = enGracia ? 'Pago pendiente' : data.nombrePlan;

  return (
    <Link
      href="/planes"
      // Igual que los links de la navbar: abajo de `sm` queda solo el ícono.
      aria-label={`Plan ${data.nombrePlan}${enGracia ? ', pago pendiente' : ''}`}
      title={
        enGracia
          ? 'No pudimos cobrar la renovación de tu plan'
          : `Plan ${data.nombrePlan}`
      }
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors duration-200',
        enGracia
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
          : data.plan === 'GRATIS'
            ? 'border-slate-700 text-slate-300 hover:bg-slate-900'
            : 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20',
      )}
    >
      <Crown className="size-3.5 shrink-0" />
      <span className="hidden sm:inline">{texto}</span>
    </Link>
  );
}
