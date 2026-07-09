'use client';

import Link from 'next/link';
import { MapPinned, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ViajeCard } from '@/components/viajes/viaje-card';
import { useViajes } from '@/lib/query/use-viajes';

export default function DashboardPage() {
  const { data: viajes, isLoading, isError } = useViajes();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mis viajes</h1>
          <p className="text-muted-foreground text-sm">
            Todos tus viajes planificados en un solo lugar.
          </p>
        </div>
        <Button asChild>
          <Link href="/viajes/nuevo">
            <Plus className="size-4" />
            Nuevo viaje
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-destructive text-sm">
          No se pudieron cargar tus viajes. Reintentá en unos segundos.
        </p>
      )}

      {viajes && viajes.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <MapPinned className="text-muted-foreground size-10" />
          <div>
            <p className="font-medium">Todavía no tenés viajes</p>
            <p className="text-muted-foreground text-sm">
              Creá tu primer viaje y generá un itinerario con IA.
            </p>
          </div>
          <Button asChild>
            <Link href="/viajes/nuevo">
              <Plus className="size-4" />
              Crear mi primer viaje
            </Link>
          </Button>
        </div>
      )}

      {viajes && viajes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {viajes.map((v) => (
            <ViajeCard key={v.id} viaje={v} />
          ))}
        </div>
      )}
    </div>
  );
}
