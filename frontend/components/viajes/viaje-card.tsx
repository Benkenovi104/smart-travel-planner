import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EstadoBadge } from './estado-badge';
import { formatRango } from '@/lib/format';
import type { Viaje } from '@/lib/types/models';

export function ViajeCard({ viaje }: { viaje: Viaje }) {
  return (
    <Link href={`/viajes/${viaje.id}`} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-1.5">
              <MapPin className="text-muted-foreground size-4 shrink-0" />
              {viaje.destinoPrincipal}
            </CardTitle>
            <EstadoBadge estado={viaje.estado} />
          </div>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            {formatRango(viaje.fechaInicio, viaje.fechaFin)}
          </p>
          <p className="flex items-center gap-1.5">
            <Users className="size-4" />
            {viaje.cantidadPersonas ?? 1}{' '}
            {viaje.cantidadPersonas === 1 ? 'persona' : 'personas'}
            <span className="text-muted-foreground/60">·</span>
            desde {viaje.origen}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
