'use client';

import Link from 'next/link';
import { MapPinned, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ViajeCard } from '@/components/viajes/viaje-card';
import { useViajes } from '@/lib/query/use-viajes';

export default function DashboardPage() {
  const { data: viajes, isLoading, isError } = useViajes();

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-linear-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800/80 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Panel de Control
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Mis Viajes
            </h1>
            <p className="text-slate-400 text-sm max-w-lg">
              Gestioná y visualizá todos tus itinerarios planificados con inteligencia artificial.
            </p>
          </div>

          <Button
            asChild
            className="bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-sky-500/20 gap-2 h-11 px-6 rounded-full transition-all duration-200"
          >
            <Link href="/viajes/nuevo">
              <Plus className="w-4 h-4" />
              Planificar Nuevo Viaje
            </Link>
          </Button>
        </div>
      </div>

      {/* Grid Status / Loading */}
      {isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl bg-slate-900 border border-slate-800" />
          ))}
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
          No se pudieron cargar tus viajes. Reintentá en unos segundos.
        </div>
      )}

      {viajes && viajes.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-800 p-12 text-center bg-slate-900/40 backdrop-blur-md">
          <div className="p-4 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <MapPinned className="w-10 h-10" />
          </div>
          <div className="space-y-1 max-w-md">
            <p className="font-bold text-lg text-white">Todavía no tenés viajes creados</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Creá tu primer viaje indicando las fechas e intereses, y nuestro asistente con IA armará tu itinerario completo día por día.
            </p>
          </div>
          <Button
            asChild
            className="mt-2 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-sky-500/20 gap-2 rounded-full px-6"
          >
            <Link href="/viajes/nuevo">
              <Plus className="w-4 h-4" />
              Crear mi primer viaje
            </Link>
          </Button>
        </div>
      )}

      {viajes && viajes.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {viajes.map((v) => (
            <ViajeCard key={v.id} viaje={v} />
          ))}
        </div>
      )}
    </div>
  );
}
