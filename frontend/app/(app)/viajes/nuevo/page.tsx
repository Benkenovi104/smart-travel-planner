'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useCrearViaje } from '@/lib/query/use-viajes';
import { useIntereses } from '@/lib/query/use-usuario';
import { ApiError } from '@/lib/api/client';

const schema = z
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

type Values = z.infer<typeof schema>;

function toOptionalNumber(v: string | undefined): number | undefined {
  if (!v || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default function NuevoViajePage() {
  const router = useRouter();
  const crear = useCrearViaje();
  const { data: intereses } = useIntereses();
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      origen: '',
      destino_principal: '',
      fecha_inicio: '',
      fecha_fin: '',
      cantidad_personas: '',
      presupuesto_total: '',
    },
  });

  function toggleInteres(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(values: Values) {
    crear.mutate(
      {
        origen: values.origen,
        destino_principal: values.destino_principal,
        fecha_inicio: values.fecha_inicio,
        fecha_fin: values.fecha_fin,
        cantidad_personas: toOptionalNumber(values.cantidad_personas),
        presupuesto_total: toOptionalNumber(values.presupuesto_total),
        intereses: seleccionados.size ? [...seleccionados] : undefined,
      },
      {
        onSuccess: (viaje) => {
          toast.success('Viaje creado');
          router.replace(`/viajes/${viaje.id}`);
        },
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : 'No se pudo crear el viaje',
          ),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Nuevo viaje</CardTitle>
          <CardDescription>
            Contanos a dónde vas y qué te interesa; después generamos el
            itinerario.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="origen"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origen</FormLabel>
                      <FormControl>
                        <Input placeholder="Buenos Aires" {...field} />
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
                        <Input placeholder="París" {...field} />
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
                        <Input
                          type="number"
                          min={1}
                          placeholder="2"
                          {...field}
                        />
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
                        <Input
                          type="number"
                          min={0}
                          placeholder="3000"
                          {...field}
                        />
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
                  {!intereses && (
                    <span className="text-muted-foreground text-sm">
                      Cargando intereses…
                    </span>
                  )}
                  {intereses?.map((i) => {
                    const activo = seleccionados.has(i.id);
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => toggleInteres(i.id)}
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
            </CardContent>

            <div className="flex justify-end gap-3 p-6 pt-0">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={crear.isPending}>
                {crear.isPending && <Loader2 className="animate-spin" />}
                Crear viaje
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
