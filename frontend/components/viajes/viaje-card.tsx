import Link from 'next/link';
import { CalendarDays, MapPin, Users, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EstadoBadge } from './estado-badge';
import { PRIMER_PASO } from './wizard-pasos';
import { formatRango } from '@/lib/format';
import type { Viaje } from '@/lib/types/models';

export function ViajeCard({ viaje }: { viaje: Viaje }) {
  // Un borrador todavía no terminó el wizard: lo mandamos ahí en vez de al
  // detalle, que igual redirigiría.
  const esBorrador = viaje.estado === 'borrador';
  const href = esBorrador
    ? `/viajes/${viaje.id}/crear?paso=${PRIMER_PASO}`
    : `/viajes/${viaje.id}`;

  return (
    // `min-w-0`: como grid item del dashboard, por defecto no baja del
    // min-content de la card y la desborda fuera del viewport en mobile. Con
    // esto se ajusta a la columna y el truncado de adentro hace su trabajo.
    <Link href={href} className="group block min-w-0">
      <Card className="h-full bg-slate-900/80 border border-slate-800/80 hover:border-sky-500/50 backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-sky-500/10 hover:-translate-y-1 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                <MapPin className="w-4 h-4 shrink-0" />
              </div>
              {/* Destinos largos ("San Pedro, Misiones, Argentina") envuelven en
                  vez de empujar el badge fuera de la card. */}
              <span className="min-w-0 break-words">
                {viaje.destinoPrincipal}
              </span>
            </CardTitle>
            <div className="shrink-0">
              <EstadoBadge estado={viaje.estado} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-400">
          <div className="flex items-center gap-2 text-xs">
            <CalendarDays className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{formatRango(viaje.fechaInicio, viaje.fechaFin)}</span>
          </div>

          {/* El `truncate` del origen sólo funciona con `min-w-0`: por defecto un
              flex item no baja de su ancho de contenido, y con orígenes largos
              ("Buenos Aires, Ciudad Autónoma de Buenos Aires") desbordaba la card. */}
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <Users className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="shrink-0 whitespace-nowrap">
              {viaje.cantidadPersonas ?? 1}{' '}
              {viaje.cantidadPersonas === 1 ? 'persona' : 'personas'}
            </span>
            <span className="text-slate-600 shrink-0">·</span>
            <span className="min-w-0 truncate">Origen: {viaje.origen}</span>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-semibold text-sky-400 group-hover:translate-x-1 transition-transform">
            <span>
              {esBorrador ? 'Continuar la creación' : 'Ver detalles del viaje'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
