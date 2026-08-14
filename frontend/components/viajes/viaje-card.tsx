'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Users, ArrowRight, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EstadoBadge } from './estado-badge';
import { PRIMER_PASO } from './wizard-pasos';
import { formatRango } from '@/lib/format';
import { useEliminarViaje } from '@/lib/query/use-viajes';
import type { Viaje } from '@/lib/types/models';
import { ApiError } from '@/lib/api/client';

export function ViajeCard({ viaje }: { viaje: Viaje }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const eliminar = useEliminarViaje();

  const esBorrador = viaje.estado === 'borrador';
  const href = esBorrador
    ? `/viajes/${viaje.id}/crear?paso=${PRIMER_PASO}`
    : `/viajes/${viaje.id}`;

  function onConfirmarEliminar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    eliminar.mutate(viaje.id, {
      onSuccess: () => {
        toast.success(`Viaje a "${viaje.destinoPrincipal}" eliminado`);
        setModalAbierto(false);
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError ? err.message : 'No se pudo eliminar el viaje',
        );
      },
    });
  }

  return (
    <>
      <div className="group relative block min-w-0">
        <Link href={href} className="block h-full">
          <Card className="h-full bg-slate-900/80 border border-slate-800/80 hover:border-sky-500/50 backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-sky-500/10 hover:-translate-y-1 rounded-2xl overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex min-w-0 items-center gap-2 text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
                  <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                    <MapPin className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="min-w-0 wrap-break-word">
                    {viaje.destinoPrincipal}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  <EstadoBadge estado={viaje.estado} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setModalAbierto(true);
                    }}
                    className="size-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Eliminar viaje"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-400">
              <div className="flex items-center gap-2 text-xs">
                <CalendarDays className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{formatRango(viaje.fechaInicio, viaje.fechaFin)}</span>
              </div>

              <div className="flex min-w-0 items-center gap-2 text-xs">
                <Users className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="shrink-0 whitespace-nowrap">
                  {viaje.cantidadPersonas ?? 1}{' '}
                  {viaje.cantidadPersonas === 1 ? 'persona' : 'personas'}
                </span>
                <span className="text-slate-600 shrink-0">·</span>
                <span className="min-w-0 truncate">Origen: {viaje.origen}</span>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs font-semibold text-sky-400 group-hover:translate-x-1 transition-transform">
                <span>
                  {esBorrador ? 'Continuar la creación' : 'Ver detalles del viaje'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Modal Confirmar Eliminación */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-500 flex items-center gap-2">
              <Trash2 className="size-5" /> ¿Eliminar este viaje?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              ¿Estás seguro de que querés eliminar tu viaje a{' '}
              <strong className="text-white">{viaje.destinoPrincipal}</strong>? Se
              borrarán todos los itinerarios, reservas y presupuestos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalAbierto(false)}
              disabled={eliminar.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmarEliminar}
              disabled={eliminar.isPending}
              className="gap-2"
            >
              {eliminar.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Eliminar viaje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
