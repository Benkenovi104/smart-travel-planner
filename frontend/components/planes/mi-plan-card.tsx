'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Crown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { MedidorUso } from '@/components/planes/medidor-uso';
import { ApiError } from '@/lib/api/client';
import { formatFecha, formatMoney } from '@/lib/format';
import {
  useCancelarSuscripcion,
  useCatalogoPlanes,
  useMiPlan,
} from '@/lib/query/use-planes';
import type { MiPlan } from '@/lib/types/models';

/** Qué contarle al usuario de su suscripción, según el estado. */
function detalle(miPlan: MiPlan, precio: number | undefined): string {
  if (miPlan.plan === 'GRATIS') {
    return `Tu período se renueva el ${formatFecha(miPlan.periodoHasta)}. Con un plan pago usás más la IA y podés buscar vuelos.`;
  }
  // Los planes asignados a mano no se cobran ni vencen.
  if (miPlan.vigenteHasta === null) return 'Plan asignado, sin vencimiento.';

  switch (miPlan.estado) {
    case 'CANCELADA':
      return `Cancelaste la suscripción: conservás el plan hasta el ${formatFecha(miPlan.vigenteHasta)} y después pasás a Gratis.`;
    case 'EN_GRACIA':
      return `No pudimos cobrar la renovación del ${formatFecha(miPlan.vigenteHasta)}. Mercado Pago lo va a reintentar y mientras tanto conservás el plan unos días. Revisá tu medio de pago en Mercado Pago.`;
    default:
      return `Se renueva el ${formatFecha(miPlan.vigenteHasta)}${precio ? ` por ${formatMoney(precio)}` : ''}, con Mercado Pago.`;
  }
}

/** Plan del usuario en el perfil: estado de la suscripción, uso y cancelación. */
export function MiPlanCard() {
  const { data: miPlan } = useMiPlan();
  const { data: catalogo } = useCatalogoPlanes();
  const cancelar = useCancelarSuscripcion();
  const [abierto, setAbierto] = useState(false);

  if (!miPlan) {
    return <Skeleton className="h-48 w-full rounded-3xl bg-slate-900" />;
  }

  const precio = catalogo?.planes.find(
    (p) => p.plan === miPlan.plan,
  )?.precioMensualArs;
  const enGracia = miPlan.estado === 'EN_GRACIA';
  // Solo se cancela lo que cobra Mercado Pago: un plan asignado a mano no vence.
  const cancelable =
    miPlan.vigenteHasta !== null && (miPlan.estado === 'ACTIVA' || enGracia);

  function onCancelar() {
    cancelar.mutate(undefined, {
      onSuccess: (res) => {
        setAbierto(false);
        toast.success(res.message);
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError
            ? e.message
            : 'No pudimos cancelar la suscripción. Probá de nuevo.',
        ),
    });
  }

  return (
    <Card
      id="mi-plan"
      className="scroll-mt-24 bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl"
    >
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <Crown className="w-5 h-5 text-violet-300" />
          Mi Plan: {miPlan.nombrePlan}
        </CardTitle>
        <CardDescription className={enGracia ? 'text-amber-400' : 'text-slate-400'}>
          {enGracia && (
            <AlertTriangle className="mr-1.5 inline size-4 align-text-bottom" />
          )}
          {detalle(miPlan, precio)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MedidorUso soloUso />

        <div className="flex flex-wrap justify-end gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-full border-slate-800 text-slate-300 hover:bg-slate-800"
          >
            <Link href="/planes">
              {miPlan.plan === 'GRATIS' || miPlan.estado === 'CANCELADA'
                ? 'Ver planes'
                : 'Cambiar de plan'}
            </Link>
          </Button>

          {cancelable && (
            <Dialog open={abierto} onOpenChange={setAbierto}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="rounded-full px-6 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30"
                >
                  Cancelar suscripción
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    ¿Cancelar tu plan {miPlan.nombrePlan}?
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Mercado Pago deja de cobrarte. Conservás el plan hasta el{' '}
                    {formatFecha(miPlan.vigenteHasta)} y después pasás a Gratis.
                    Tus viajes no se borran.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      variant="outline"
                      className="border-slate-800 text-slate-300 hover:bg-slate-800"
                    >
                      Mantener mi plan
                    </Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    disabled={cancelar.isPending}
                    onClick={onCancelar}
                  >
                    {cancelar.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    )}
                    Cancelar suscripción
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
