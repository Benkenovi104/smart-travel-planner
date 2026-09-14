'use client';

import Link from 'next/link';
import { Hourglass, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  cerrarDialogoLimite,
  useDialogoLimite,
} from '@/lib/planes/dialogo-limite';
import { NOMBRE_PLAN } from '@/lib/planes/nombres';
import { formatFecha } from '@/lib/format';

/**
 * Se monta una sola vez en `app/providers.tsx`. Lo abre el manejo global de
 * mutaciones cuando el backend rechaza una acción por el plan o por el tope diario.
 */
export function DialogoLimite() {
  const detalle = useDialogoLimite();
  const esTope = detalle?.codigo === 'TOPE_DIARIO';

  return (
    <Dialog
      open={detalle !== null}
      onOpenChange={(abierto) => {
        if (!abierto) cerrarDialogoLimite();
      }}
    >
      <DialogContent>
        {detalle && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {esTope ? (
                  <Hourglass className="size-5 text-amber-500" />
                ) : (
                  <Lock className="size-5 text-sky-400" />
                )}
                {esTope
                  ? 'Llegaste al máximo por hoy'
                  : 'Llegaste al límite de tu plan'}
              </DialogTitle>
              <DialogDescription>{detalle.message}</DialogDescription>
            </DialogHeader>

            {esTope ? (
              <p className="text-muted-foreground text-sm">
                Es un tope de seguridad por día, igual para todos los planes.
              </p>
            ) : (
              detalle.renuevaEl && (
                <p className="text-muted-foreground text-sm">
                  Tu cupo se renueva el {formatFecha(detalle.renuevaEl)}.
                </p>
              )
            )}

            <DialogFooter>
              <Button variant="outline" onClick={cerrarDialogoLimite}>
                Entendido
              </Button>
              {!esTope && detalle.planSugerido && (
                <Button asChild onClick={cerrarDialogoLimite}>
                  <Link href="/planes">
                    Ver plan {NOMBRE_PLAN[detalle.planSugerido]}
                  </Link>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
