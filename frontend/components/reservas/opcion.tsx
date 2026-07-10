'use client';

import { Check, ExternalLink, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApiError } from '@/lib/api/client';
import { formatMoney } from '@/lib/format';

/** Piezas compartidas por las secciones de Vuelos y Alojamiento. */

/** El free tier de las APIs externas devuelve 429 al buscar seguido. */
export function mensajeDeError(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.status === 429) {
    return 'La API externa limitó las búsquedas por ahora. Probá de nuevo en un rato.';
  }
  return e instanceof ApiError ? e.message : fallback;
}

export function Encabezado({
  icon,
  titulo,
  descripcion,
  pending,
  vacio,
  onBuscar,
}: {
  icon: React.ReactNode;
  titulo: string;
  descripcion: string;
  pending: boolean;
  vacio: boolean;
  onBuscar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          {icon}
          {titulo}
        </h3>
        <p className="text-muted-foreground text-sm">{descripcion}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onBuscar} disabled={pending}>
        {pending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
        {pending ? 'Buscando…' : vacio ? 'Buscar' : 'Buscar de nuevo'}
      </Button>
    </div>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <div className="text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm">
      {texto}
    </div>
  );
}

export function Opcion({
  seleccionado,
  onElegir,
  pending,
  precio,
  sufijoPrecio,
  url,
  children,
}: {
  seleccionado: boolean;
  onElegir: () => void;
  pending: boolean;
  precio: number | null;
  sufijoPrecio?: string;
  url: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${
        seleccionado ? 'border-primary bg-primary/5' : ''
      }`}
    >
      <div className="min-w-0 space-y-0.5">
        {children}
        {seleccionado && (
          <Badge variant="secondary" className="mt-1">
            <Check className="size-3" />
            Suma al presupuesto
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-semibold">{formatMoney(precio)}</p>
          {sufijoPrecio && (
            <p className="text-muted-foreground text-xs">{sufijoPrecio}</p>
          )}
        </div>
        {url && (
          <Button variant="ghost" size="icon" asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver en el sitio externo"
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        <Button
          variant={seleccionado ? 'secondary' : 'default'}
          size="sm"
          onClick={onElegir}
          disabled={pending}
        >
          {seleccionado ? 'Quitar' : 'Elegir'}
        </Button>
      </div>
    </div>
  );
}
