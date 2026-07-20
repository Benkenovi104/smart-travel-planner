import Link from 'next/link';
import { CalendarDays, MapPin, Users, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EstadoBadge } from './estado-badge';
import { formatRango } from '@/lib/format';
import type { Viaje } from '@/lib/types/models';

export function ViajeCard({ viaje }: { viaje: Viaje }) {
  return (
    <Link href={`/viajes/${viaje.id}`} className="group block">
      <Card className="h-full bg-slate-900/80 border border-slate-800/80 hover:border-sky-500/50 backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-sky-500/10 hover:-translate-y-1 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <MapPin className="w-4 h-4 shrink-0" />
              </div>
              {viaje.destinoPrincipal}
            </CardTitle>
            <EstadoBadge estado={viaje.estado} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-400">
          <div className="flex items-center gap-2 text-xs">
            <CalendarDays className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{formatRango(viaje.fechaInicio, viaje.fechaFin)}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Users className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              {viaje.cantidadPersonas ?? 1}{' '}
              {viaje.cantidadPersonas === 1 ? 'persona' : 'personas'}
            </span>
            <span className="text-slate-600">·</span>
            <span className="truncate">Origen: {viaje.origen}</span>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-semibold text-sky-400 group-hover:translate-x-1 transition-transform">
            <span>Ver detalles del viaje</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
