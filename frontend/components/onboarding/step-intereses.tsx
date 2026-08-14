'use client';

import { UseFormReturn, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { PerfilFormValues } from '@/lib/validations/perfil';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProps {
  form: UseFormReturn<PerfilFormValues>;
}

interface InteresItem {
  id_interes: number;
  nombre: string;
}

export function StepIntereses({ form }: StepProps) {
  const selectedIds = useWatch({ control: form.control, name: 'interesesIds' }) || [];

  const { data: intereses, isLoading, isError } = useQuery<InteresItem[]>({
    queryKey: ['intereses-catalogo'],
    queryFn: async () => {
      const res = await fetch('/api/usuarios/intereses');
      if (!res.ok) throw new Error('Error al cargar intereses');
      return res.json();
    },
  });

  const toggleInteres = (id: number) => {
    const current = [...selectedIds];
    const index = current.indexOf(id);

    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(id);
    }

    form.setValue('interesesIds', current, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
          <Compass className="w-6 h-6 text-sky-400" />
          ¿Qué tipo de actividades disfrutás más?
        </h2>
        <p className="text-sm text-slate-400">
          Seleccioná tus intereses generales (podés elegir todos los que quieras, mínimo 1).
        </p>
      </div>

      {isLoading && (
        <div className="flex flex-wrap gap-2.5 justify-center py-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full bg-slate-800" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-400 text-center py-4">
          No se pudieron cargar los intereses. Por favor reintentá nuevamente.
        </p>
      )}

      {!isLoading && !isError && intereses && (
        <div className="flex flex-wrap gap-2.5 justify-center max-h-80 overflow-y-auto p-4 border border-slate-800 rounded-2xl bg-slate-950/60">
          {intereses.map((item) => {
            const isSelected = selectedIds.includes(item.id_interes);

            return (
              <Badge
                key={item.id_interes}
                onClick={() => toggleInteres(item.id_interes)}
                variant={isSelected ? 'default' : 'outline'}
                className={cn(
                  'px-4 py-2 text-xs font-semibold rounded-full cursor-pointer transition-all duration-200 select-none flex items-center gap-1.5 capitalize',
                  isSelected
                    ? 'bg-linear-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-sky-500 hover:text-sky-400',
                )}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                {item.nombre}
              </Badge>
            );
          })}
        </div>
      )}

      {form.formState.errors.interesesIds && (
        <p className="text-xs font-medium text-red-400 text-center">
          {form.formState.errors.interesesIds.message}
        </p>
      )}
    </div>
  );
}
