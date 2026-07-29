'use client';

import { useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useIntereses } from '@/lib/query/use-usuario';
import { toDateInput } from '@/lib/format';
import type { CreateViajeInput } from '@/lib/api/viajes';
import type { Viaje } from '@/lib/types/models';
import { CiudadAutocomplete } from './ciudad-autocomplete';

/**
 * Formulario de viaje compartido por el wizard de creación (`/viajes/nuevo`) y
 * el diálogo de edición del detalle. Cada uno arma su propio `<form>` y decide
 * qué mutación disparar; acá viven el schema, los campos y los intereses.
 */

export const viajeSchema = z
  .object({
    origen: z.string().min(1, 'Requerido').max(255),
    destino_principal: z.string().min(1, 'Requerido').max(255),
    fecha_inicio: z.string().min(1, 'Requerido'),
    fecha_fin: z.string().min(1, 'Requerido'),
    cantidad_personas: z.string().optional(),
    presupuesto_total: z.string().optional(),
  })
  .refine((d) => d.fecha_fin >= d.fecha_inicio, {
    message: 'La fecha de fin debe ser igual o posterior al inicio',
    path: ['fecha_fin'],
  });

export type ViajeFormValues = z.infer<typeof viajeSchema>;

function toOptionalNumber(v: string | undefined): number | undefined {
  if (!v || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Valores del form -> payload del backend (snake_case, números y no strings). */
export function toViajePayload(
  values: ViajeFormValues,
  intereses: Set<number>,
): CreateViajeInput {
  return {
    origen: values.origen,
    destino_principal: values.destino_principal,
    fecha_inicio: values.fecha_inicio,
    fecha_fin: values.fecha_fin,
    cantidad_personas: toOptionalNumber(values.cantidad_personas),
    presupuesto_total: toOptionalNumber(values.presupuesto_total),
    intereses: intereses.size ? [...intereses] : undefined,
  };
}

const VACIO: ViajeFormValues = {
  origen: '',
  destino_principal: '',
  fecha_inicio: '',
  fecha_fin: '',
  cantidad_personas: '',
  presupuesto_total: '',
};

function valoresDe(viaje: Viaje): ViajeFormValues {
  return {
    origen: viaje.origen,
    destino_principal: viaje.destinoPrincipal,
    fecha_inicio: toDateInput(viaje.fechaInicio),
    fecha_fin: toDateInput(viaje.fechaFin),
    cantidad_personas: viaje.cantidadPersonas?.toString() ?? '',
    presupuesto_total: viaje.presupuestoTotal?.toString() ?? '',
  };
}

/**
 * Estado del formulario: react-hook-form para los campos y un `Set` aparte para
 * los intereses, que no son un input controlado sino badges toggleables.
 * Si recibe un `viaje` arranca precargado (modo edición).
 */
export function useViajeForm(viaje?: Viaje) {
  const form = useForm<ViajeFormValues>({
    resolver: zodResolver(viajeSchema),
    defaultValues: viaje ? valoresDe(viaje) : VACIO,
  });

  const [intereses, setIntereses] = useState<Set<number>>(
    () => new Set(viaje?.intereses.map((i) => i.id) ?? []),
  );

  function toggleInteres(id: number) {
    setIntereses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return { form, intereses, toggleInteres };
}

export function ViajeFormFields({
  form,
  intereses,
  onToggleInteres,
}: {
  form: UseFormReturn<ViajeFormValues>;
  intereses: Set<number>;
  onToggleInteres: (id: number) => void;
}) {
  const { data: disponibles } = useIntereses();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="origen"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Origen</FormLabel>
              <FormControl>
                <CiudadAutocomplete
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Ej: Buenos Aires, Argentina"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="destino_principal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destino</FormLabel>
              <FormControl>
                <CiudadAutocomplete
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Ej: Bariloche, Río Negro, Argentina"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="fecha_inicio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de inicio</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fecha_fin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de fin</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="cantidad_personas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cantidad de personas</FormLabel>
              <FormControl>
                <Input type="number" min={1} placeholder="2" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="presupuesto_total"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Presupuesto total (opcional)</FormLabel>
              <FormControl>
                <Input type="number" min={0} placeholder="3000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormItem>
        <FormLabel>Intereses del viaje</FormLabel>
        <FormDescription>
          Priorizá qué querés hacer en este viaje (opcional).
        </FormDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          {!disponibles && (
            <span className="text-muted-foreground text-sm">
              Cargando intereses…
            </span>
          )}
          {disponibles?.map((i) => {
            const activo = intereses.has(i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => onToggleInteres(i.id)}
              >
                <Badge
                  variant={activo ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer capitalize',
                    !activo && 'hover:bg-muted',
                  )}
                >
                  {i.nombre}
                </Badge>
              </button>
            );
          })}
        </div>
      </FormItem>
    </>
  );
}
