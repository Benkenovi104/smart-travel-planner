'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
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
import { PRIMER_PASO, WizardPasos } from '@/components/viajes/wizard-pasos';
import { useCrearViaje } from '@/lib/query/use-viajes';
import { ApiError } from '@/lib/api/client';

export default function NuevoViajePage() {
  const router = useRouter();
  const crear = useCrearViaje();
  const { form, intereses, toggleInteres } = useViajeForm();

  function onSubmit(values: ViajeFormValues) {
    crear.mutate(toViajePayload(values, intereses), {
      onSuccess: (viaje) => {
        // El viaje nace en borrador: seguimos al paso 2 del wizard, que ya
        // necesita el id para poder buscar vuelos.
        router.replace(`/viajes/${viaje.id}/crear?paso=${PRIMER_PASO}`);
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : 'No se pudo crear el viaje',
        ),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </Button>

      <WizardPasos actual={1} />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">¿A dónde vas?</CardTitle>
          <CardDescription>
            Contanos el destino, las fechas y qué te interesa. Después vas a
            poder elegir vuelo y alojamiento.
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
                Siguiente
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
