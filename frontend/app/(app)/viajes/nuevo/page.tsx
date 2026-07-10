'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import {
  ViajeFormFields,
  toViajePayload,
  useViajeForm,
  type ViajeFormValues,
} from '@/components/viajes/viaje-form';
import { useCrearViaje } from '@/lib/query/use-viajes';
import { ApiError } from '@/lib/api/client';

export default function NuevoViajePage() {
  const router = useRouter();
  const crear = useCrearViaje();
  const { form, intereses, toggleInteres } = useViajeForm();

  function onSubmit(values: ViajeFormValues) {
    crear.mutate(toViajePayload(values, intereses), {
      onSuccess: (viaje) => {
        toast.success('Viaje creado');
        router.replace(`/viajes/${viaje.id}`);
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : 'No se pudo crear el viaje',
        ),
    });
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
              <ViajeFormFields
                form={form}
                intereses={intereses}
                onToggleInteres={toggleInteres}
              />
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
