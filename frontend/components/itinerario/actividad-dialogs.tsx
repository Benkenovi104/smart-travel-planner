'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAgregarActividad,
  useEditarActividad,
} from '@/lib/query/use-itinerario';
import { ApiError } from '@/lib/api/client';
import { formatHora } from '@/lib/format';
import type { Actividad } from '@/lib/types/models';

// Sin "alojamiento": es un costo del viaje, no una actividad de un día. El hotel
// se elige una vez por viaje desde el tab Alojamiento.
const TIPOS = ['visita', 'comida', 'transporte', 'entretenimiento'];
const ESTADOS = ['pendiente', 'completada', 'cancelada'];
const NONE = '__none__';

const horaOpt = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm')
  .optional()
  .or(z.literal(''));

function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

function toNum(v: string | undefined): number | undefined {
  if (!v || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ---------- Agregar ----------
const createSchema = z
  .object({
    nombre_lugar: z.string().min(1, 'Requerido').max(255),
    ciudad: z.string().max(255).optional(),
    categoria: z.string().max(100).optional(),
    tipo_actividad: z.string().optional(),
    hora_inicio: horaOpt,
    hora_fin: horaOpt,
    costo_estimado: z.string().optional(),
  });
type CreateValues = z.infer<typeof createSchema>;

export function AgregarActividadDialog({
  idViaje,
  idDia,
  children,
}: {
  idViaje: number;
  idDia: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const agregar = useAgregarActividad(idViaje);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      nombre_lugar: '',
      ciudad: '',
      categoria: '',
      tipo_actividad: '',
      hora_inicio: '',
      hora_fin: '',
      costo_estimado: '',
    },
  });

  function onSubmit(v: CreateValues) {
    agregar.mutate(
      {
        idDia,
        input: {
          nombre_lugar: v.nombre_lugar,
          ciudad: v.ciudad || undefined,
          categoria: v.categoria || undefined,
          tipo_actividad: v.tipo_actividad || undefined,
          hora_inicio: v.hora_inicio || undefined,
          hora_fin: v.hora_fin || undefined,
          costo_estimado: toNum(v.costo_estimado),
        },
      },
      {
        onSuccess: () => {
          toast.success('Actividad agregada');
          form.reset();
          setOpen(false);
        },
        onError: (e) => toast.error(errMsg(e, 'No se pudo agregar')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar actividad</DialogTitle>
          <DialogDescription>
            Sumá un lugar o actividad a este día.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre_lugar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lugar / actividad</FormLabel>
                  <FormControl>
                    <Input placeholder="Museo del Louvre" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input placeholder="París" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipo_actividad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={(val) =>
                        field.onChange(val === NONE ? '' : val)
                      }
                      value={field.value || NONE}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin especificar</SelectItem>
                        {TIPOS.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="hora_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desde</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hora_fin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hasta</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costo_estimado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="0" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={agregar.isPending}>
                {agregar.isPending && <Loader2 className="animate-spin" />}
                Agregar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Editar ----------
const editSchema = z
  .object({
    tipo_actividad: z.string().optional(),
    estado: z.string().optional(),
    hora_inicio: horaOpt,
    hora_fin: horaOpt,
    costo_estimado: z.string().optional(),
  });
type EditValues = z.infer<typeof editSchema>;

export function EditarActividadDialog({
  idViaje,
  actividad,
  children,
}: {
  idViaje: number;
  actividad: Actividad;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const editar = useEditarActividad(idViaje);
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: {
      tipo_actividad: actividad.tipo ?? '',
      estado: actividad.estado ?? 'pendiente',
      hora_inicio: formatHora(actividad.horaInicio) ?? '',
      hora_fin: formatHora(actividad.horaFin) ?? '',
      costo_estimado:
        actividad.costoEstimado != null ? String(actividad.costoEstimado) : '',
    },
  });

  function onSubmit(v: EditValues) {
    editar.mutate(
      {
        idActividad: actividad.id,
        input: {
          tipo_actividad: v.tipo_actividad || undefined,
          estado: (v.estado || undefined) as
            | 'pendiente'
            | 'completada'
            | 'cancelada'
            | undefined,
          hora_inicio: v.hora_inicio || undefined,
          hora_fin: v.hora_fin || undefined,
          costo_estimado: toNum(v.costo_estimado),
        },
      },
      {
        onSuccess: () => {
          toast.success('Actividad actualizada');
          setOpen(false);
        },
        onError: (e) => toast.error(errMsg(e, 'No se pudo actualizar')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{actividad.lugar.nombre}</DialogTitle>
          <DialogDescription>Editá los detalles de la actividad.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="tipo_actividad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      onValueChange={(val) =>
                        field.onChange(val === NONE ? '' : val)
                      }
                      value={field.value || NONE}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Sin especificar</SelectItem>
                        {TIPOS.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ESTADOS.map((e) => (
                          <SelectItem key={e} value={e} className="capitalize">
                            {e}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="hora_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desde</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hora_fin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hasta</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costo_estimado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editar.isPending}>
                {editar.isPending && <Loader2 className="animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
