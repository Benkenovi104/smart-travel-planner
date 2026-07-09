import { Clock, MapPin, Wallet } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatFecha, formatHora, formatMoney } from '@/lib/format';
import type { Actividad, Itinerario } from '@/lib/types/models';

function horario(a: Actividad): string | null {
  const inicio = formatHora(a.horaInicio);
  const fin = formatHora(a.horaFin);
  if (inicio && fin) return `${inicio} – ${fin}`;
  return inicio ?? fin;
}

function ActividadItem({ actividad }: { actividad: Actividad }) {
  const hora = horario(actividad);
  return (
    <li className="flex gap-3 py-3">
      <div className="text-muted-foreground w-24 shrink-0 text-sm">
        {hora ? (
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            {hora}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{actividad.lugar.nombre}</span>
          {actividad.tipo && (
            <Badge variant="secondary" className="capitalize">
              {actividad.tipo}
            </Badge>
          )}
        </div>
        {(actividad.lugar.categoria || actividad.lugar.ciudad) && (
          <p className="text-muted-foreground text-sm capitalize">
            {[actividad.lugar.categoria, actividad.lugar.ciudad]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
      {actividad.costoEstimado != null && actividad.costoEstimado > 0 && (
        <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm">
          <Wallet className="size-3.5" />
          {formatMoney(actividad.costoEstimado)}
        </div>
      )}
    </li>
  );
}

export function ItinerarioView({ itinerario }: { itinerario: Itinerario }) {
  if (itinerario.dias.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        El itinerario no tiene días cargados.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {itinerario.dias.map((dia) => (
        <Card key={dia.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full text-sm">
                  {dia.numeroDia}
                </span>
                Día {dia.numeroDia}
                <span className="text-muted-foreground font-normal">
                  · {formatFecha(dia.fecha)}
                </span>
              </CardTitle>
              {dia.costoEstimado != null && dia.costoEstimado > 0 && (
                <span className="text-muted-foreground text-sm">
                  {formatMoney(dia.costoEstimado)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {dia.actividades.length === 0 ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <MapPin className="size-4" />
                Sin actividades este día.
              </p>
            ) : (
              <ul className="divide-y">
                {dia.actividades.map((a) => (
                  <ActividadItem key={a.id} actividad={a} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
