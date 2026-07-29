'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useCiudadesAutocomplete } from '@/lib/query/use-lugares';
import type { CiudadSugerida } from '@/lib/api/lugares';
import { cn } from '@/lib/utils';

interface CiudadAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CiudadAutocomplete({
  value,
  onChange,
  placeholder = 'Buscar ciudad...',
  className,
}: CiudadAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(value ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar si cambia el value desde props (ej: al precargar en modo edición)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(value ?? '');
  }, [value]);

  // Debounce de 300ms para no saturar peticiones
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: sugerencias, isFetching } = useCiudadesAutocomplete(
    debouncedQuery,
    isOpen,
  );

  // Cerrar el dropdown al hacer clic fuera del contenedor
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setInputValue(text);
    onChange(text);
    setIsOpen(true);
  }

  function handleSelect(sugerencia: CiudadSugerida) {
    const textoSeleccionado = sugerencia.descripcion;
    setInputValue(textoSeleccionado);
    onChange(textoSeleccionado);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn('pr-8', className)}
        />
        {isFetching && (
          <div className="absolute right-2.5 top-2.5 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
      </div>

      {isOpen && sugerencias && sugerencias.length > 0 && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 max-h-60 overflow-y-auto">
          {sugerencias.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 group cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {s.ciudad}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {s.descripcion}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
