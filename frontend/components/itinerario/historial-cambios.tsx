'use client';

import { useState } from 'react';
import { History, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useHistorialCambios } from '@/lib/query/use-itinerario';
import { formatFechaHora } from '@/lib/format';

export function HistorialCambios({ idViaje }: { idViaje: number }) {
  const [open, setOpen] = useState(false);
  // Solo consultamos cuando el diálogo está abierto.
  const { data, isLoading, isError } = useHistorialCambios(idViaje, open);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History className="size-4" />
          Historial
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historial de cambios</DialogTitle>
          <DialogDescription>
            Modificaciones manuales del itinerario.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </div>
        )}

        {isError && (
          <p className="text-destructive py-6 text-sm">
            No se pudo cargar el historial.
          </p>
        )}

        {data && data.length === 0 && (
          <p className="text-muted-foreground py-6 text-sm">
            Todavía no hay cambios registrados.
          </p>
        )}

        {data && data.length > 0 && (
          <ul className="max-h-96 space-y-3 overflow-y-auto">
            {data.map((c) => (
              <li key={c.id} className="flex items-start gap-3 text-sm">
                <span className="bg-muted mt-1.5 size-2 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p>{c.descripcion ?? c.tipo ?? 'Cambio'}</p>
                  <p className="text-muted-foreground flex items-center gap-2 text-xs">
                    {formatFechaHora(c.fecha)}
                    {c.tipo && (
                      <Badge variant="outline" className="text-[10px]">
                        {c.tipo.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
