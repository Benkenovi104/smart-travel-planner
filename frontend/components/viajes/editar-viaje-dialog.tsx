'use client';

import { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import {
  ViajeFormFields,
  toViajePayload,
  useViajeForm,
  type ViajeFormValues,
} from '@/components/viajes/viaje-form';
import { useActualizarViaje } from '@/lib/query/use-viajes';
import { ApiError } from '@/lib/api/client';
import { toDateInput } from '@/lib/format';
import type { Viaje } from '@/lib/types/models';

export function EditarViajeDialog({
  viaje,
  tieneItinerario,
}: {
  viaje: Viaje;
  tieneItinerario: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Editar
        </Button>
      </DialogTrigger>
      {/* Radix desmonta el contenido al cerrar, así que el formulario vuelve a
          montarse con los valores del viaje y no hace falta resetearlo a mano. */}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar viaje</DialogTitle>
          <DialogDescription>
            Cambiá los datos del viaje. El presupuesto se recalcula solo.
          </DialogDescription>
        </DialogHeader>
        <EditarViajeForm
          viaje={viaje}
          tieneItinerario={tieneItinerario}
          onListo={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditarViajeForm({
  viaje,
  tieneItinerario,
  onListo,
}: {
  viaje: Viaje;
  tieneItinerario: boolean;
  onListo: () => void;
}) {
  const actualizar = useActualizarViaje(viaje.id);
  const { form, intereses, toggleInteres } = useViajeForm(viaje);

  function onSubmit(values: ViajeFormValues) {
    const cambianLasFechas =
      values.fecha_inicio !== toDateInput(viaje.fechaInicio) ||
      values.fecha_fin !== toDateInput(viaje.fechaFin);

    // El backend reajusta los días del itinerario a las fechas nuevas: recalcula
    // sus fechas y agrega/borra días. Avisamos según qué pasó, porque acortar
    // pierde actividades y alargar deja días vacíos (el contenido no se replanifica).
    const diasDe = (inicio: string, fin: string) =>
      Math.round(
        (new Date(fin).getTime() - new Date(inicio).getTime()) / 86_400_000,
      ) + 1;
    const diasAntes = diasDe(
      toDateInput(viaje.fechaInicio),
      toDateInput(viaje.fechaFin),
    );
    const diasAhora = diasDe(values.fecha_inicio, values.fecha_fin);

    actualizar.mutate(toViajePayload(values, intereses), {
      onSuccess: () => {
        onListo();
        toast.success('Viaje actualizado');
        if (cambianLasFechas && tieneItinerario) {
          if (diasAhora < diasAntes) {
            toast.warning('Se acortó el itinerario', {
              description:
                'Se quitaron los días sobrantes y sus actividades. Regeneralo si querés replanificarlo.',
            });
          } else if (diasAhora > diasAntes) {
            toast.info('Se agregaron días vacíos al itinerario', {
              description: 'Sumá actividades a mano o regeneralo.',
            });
          } else {
            toast.info('Se actualizaron las fechas de los días del itinerario');
          }
        }
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : 'No se pudo actualizar el viaje',
        ),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <ViajeFormFields
          form={form}
          intereses={intereses}
          onToggleInteres={toggleInteres}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onListo}>
            Cancelar
          </Button>
          <Button type="submit" disabled={actualizar.isPending}>
            {actualizar.isPending && <Loader2 className="animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
