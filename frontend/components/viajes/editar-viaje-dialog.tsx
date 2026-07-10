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

    actualizar.mutate(toViajePayload(values, intereses), {
      onSuccess: () => {
        onListo();
        toast.success('Viaje actualizado');
        // Los días del itinerario conservan las fechas viejas: el backend no los
        // recorre al editar el viaje, hay que regenerarlo.
        if (cambianLasFechas && tieneItinerario) {
          toast.warning('El itinerario quedó con las fechas anteriores', {
            description: 'Regeneralo para alinearlo con las fechas nuevas.',
          });
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
