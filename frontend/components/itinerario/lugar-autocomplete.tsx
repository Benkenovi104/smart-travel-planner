'use client';

import { useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Search, Star, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLugares } from '@/lib/query/use-lugares';
import type { Lugar } from '@/lib/types/models';

/** Minúsculas y sin tildes, para que "cafe" matchee "Café". */
function plano(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

const MIN_CHARS = 2;
const MAX_RESULTADOS = 8;

/**
 * Busca lugares reales del destino y deja elegir uno. El lugar elegido llega con
 * coordenadas, categoría y rating de Google Places, así que la actividad no depende
 * del geocoding por nombre (que falla seguido).
 *
 * Si no se elige nada, el texto escrito sigue valiendo como nombre libre.
 */
export function LugarAutocomplete({
  destino,
  value,
  onValueChange,
  seleccionado,
  onSeleccionar,
}: {
  destino: string | undefined;
  value: string;
  onValueChange: (texto: string) => void;
  seleccionado: Lugar | null;
  onSeleccionar: (lugar: Lugar | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // La búsqueda al backend recién arranca cuando hay algo escrito: cada llamada
  // son 8 requests a Google Places.
  const buscar = value.trim().length >= MIN_CHARS && !seleccionado;
  const { data: lugares, isFetching, isError } = useLugares(destino, buscar);

  const resultados = useMemo(() => {
    if (!lugares) return [];
    const q = plano(value.trim());
    return lugares
      .filter((l) => plano(l.nombre).includes(q))
      .slice(0, MAX_RESULTADOS);
  }, [lugares, value]);

  const mostrarLista = abierto && buscar;

  function elegir(lugar: Lugar) {
    onSeleccionar(lugar);
    onValueChange(lugar.nombre);
    setAbierto(false);
  }

  function limpiar() {
    onSeleccionar(null);
    onValueChange('');
    setAbierto(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!mostrarLista || resultados.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setResaltado((i) => (i + 1) % resultados.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setResaltado((i) => (i - 1 + resultados.length) % resultados.length);
    } else if (e.key === 'Enter') {
      // No dejamos que el Enter envíe el formulario mientras se elige un lugar.
      e.preventDefault();
      elegir(resultados[resaltado]);
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  }

  // `min-w-0` en el contenedor: es un grid item (FormItem es un grid) y sin eso el
  // nombre largo de un lugar de Google Places no trunca y desborda el diálogo.
  if (seleccionado) {
    return (
      <div className="flex w-full min-w-0 items-start justify-between gap-2 rounded-md border px-3 py-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">{seleccionado.nombre}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            {seleccionado.ciudad && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {seleccionado.ciudad}
              </span>
            )}
            {seleccionado.rating != null && (
              <span className="flex items-center gap-1">
                <Star className="size-3" />
                {seleccionado.rating}
              </span>
            )}
            {seleccionado.categoria && (
              <Badge variant="secondary" className="capitalize">
                {seleccionado.categoria.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={limpiar}
          aria-label="Quitar el lugar elegido"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls="lugares-listbox"
        autoComplete="off"
        placeholder="Museo del Louvre"
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setAbierto(true);
          setResaltado(0);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={onKeyDown}
      />

      {mostrarLista && (
        <div
          id="lugares-listbox"
          role="listbox"
          className="bg-popover absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border shadow-md"
          // El input pierde el foco antes del click; sin esto la lista se cierra
          // y el click nunca llega a la opción.
          onMouseDown={(e) => e.preventDefault()}
        >
          {isFetching && (
            <p className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
              <Loader2 className="size-3.5 animate-spin" />
              Buscando lugares en {destino}…
            </p>
          )}

          {!isFetching && isError && (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              No se pudieron buscar lugares. Se guardará como texto libre.
            </p>
          )}

          {!isFetching && !isError && resultados.length === 0 && (
            <p className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
              <Search className="size-3.5" />
              Sin coincidencias. Se guardará como texto libre.
            </p>
          )}

          {!isFetching &&
            resultados.map((lugar, i) => (
              <button
                key={lugar.id}
                type="button"
                role="option"
                aria-selected={i === resaltado}
                onMouseEnter={() => setResaltado(i)}
                onClick={() => elegir(lugar)}
                className={cn(
                  'block w-full px-3 py-2 text-left text-sm',
                  i === resaltado && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="block truncate font-medium">{lugar.nombre}</span>
                <span className="text-muted-foreground block truncate text-xs capitalize">
                  {[lugar.categoria?.replace(/_/g, ' '), lugar.ciudad]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
