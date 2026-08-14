'use client';

import type { Viaje } from '@/lib/types/models';
import { AlojamientoSelector } from './alojamiento-selector';

export function AlojamientoSection({
  idViaje,
  viaje,
}: {
  idViaje: number;
  viaje: Viaje;
}) {
  return <AlojamientoSelector idViaje={idViaje} viaje={viaje} />;
}
