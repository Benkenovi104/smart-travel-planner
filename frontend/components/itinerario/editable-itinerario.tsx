'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import { formatFecha, formatHora, formatMoney } from '@/lib/format';
import {
  useEliminarActividad,
  useMoverActividad,
} from '@/lib/query/use-itinerario';
import { ApiError } from '@/lib/api/client';
import type { Actividad, Itinerario } from '@/lib/types/models';
import {
  AgregarActividadDialog,
  EditarActividadDialog,
} from './actividad-dialogs';

function horario(a: Actividad): string | null {
  const inicio = formatHora(a.horaInicio);
  const fin = formatHora(a.horaFin);
  if (inicio && fin) return `${inicio} – ${fin}`;
  return inicio ?? fin;
}

// ---------- Tarjeta de actividad (sortable) ----------
function ActividadCard({
  actividad,
  idViaje,
}: {
  actividad: Actividad;
  idViaje: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: actividad.id });
  const eliminar = useEliminarActividad(idViaje);
  const hora = horario(actividad);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card flex items-start gap-2 rounded-lg border p-3',
        isDragging && 'opacity-40',
        actividad.estado === 'cancelada' && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground mt-0.5 cursor-grab touch-none active:cursor-grabbing"
        aria-label="Arrastrar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'font-medium',
              actividad.estado === 'completada' && 'line-through',
            )}
          >
            {actividad.lugar.nombre}
          </span>
          {actividad.tipo && (
            <Badge variant="secondary" className="capitalize">
              {actividad.tipo}
            </Badge>
          )}
          {actividad.estado && actividad.estado !== 'pendiente' && (
            <Badge
              variant={
                actividad.estado === 'cancelada' ? 'destructive' : 'outline'
              }
              className="capitalize"
            >
              {actividad.estado}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {hora && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {hora}
            </span>
          )}
          {actividad.costoEstimado != null && actividad.costoEstimado > 0 && (
            <span className="flex items-center gap-1">
              <Wallet className="size-3.5" />
              {formatMoney(actividad.costoEstimado)}
            </span>
          )}
          {actividad.lugar.categoria && (
            <span className="capitalize">{actividad.lugar.categoria}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <EditarActividadDialog idViaje={idViaje} actividad={actividad}>
          <Button variant="ghost" size="icon" className="size-8">
            <Pencil className="size-4" />
          </Button>
        </EditarActividadDialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-8"
            >
              <Trash2 className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar actividad?</DialogTitle>
              <DialogDescription>
                Se quitará &quot;{actividad.lugar.nombre}&quot; del itinerario.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={eliminar.isPending}
                onClick={() =>
                  eliminar.mutate(actividad.id, {
                    onSuccess: () => toast.success('Actividad eliminada'),
                    onError: (e) =>
                      toast.error(
                        e instanceof ApiError
                          ? e.message
                          : 'No se pudo eliminar',
                      ),
                  })
                }
              >
                {eliminar.isPending && <Loader2 className="animate-spin" />}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </li>
  );
}

// Vista estática de una tarjeta (para el DragOverlay).
function ActividadCardOverlay({ actividad }: { actividad: Actividad }) {
  const hora = horario(actividad);
  return (
    <div className="bg-card flex items-start gap-2 rounded-lg border p-3 shadow-lg">
      <GripVertical className="text-muted-foreground mt-0.5 size-4" />
      <div>
        <span className="font-medium">{actividad.lugar.nombre}</span>
        {hora && (
          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
            <Clock className="size-3.5" />
            {hora}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Columna de día (droppable + colapsable) ----------
function DiaColumn({
  dia,
  idViaje,
  open,
  onToggle,
}: {
  dia: Itinerario['dias'][number];
  idViaje: number;
  open: boolean;
  onToggle: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dia.id}` });

  // Total del día calculado desde las actividades (las canceladas no cuentan),
  // así se mantiene consistente con lo que se ve al editar/agregar/eliminar.
  const totalDia = dia.actividades.reduce(
    (sum, a) => (a.estado === 'cancelada' ? sum : sum + (a.costoEstimado ?? 0)),
    0,
  );
  const cantidad = dia.actividades.length;

  return (
    <Card id={`dia-${dia.id}`} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex flex-1 items-center gap-2 text-left"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="text-muted-foreground size-4 shrink-0" />
            ) : (
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            )}
            <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm">
              {dia.numeroDia}
            </span>
            <span className="font-semibold">Día {dia.numeroDia}</span>
            <span className="text-muted-foreground text-sm">
              · {formatFecha(dia.fecha)}
            </span>
          </button>
          <div className="flex items-center gap-3">
            {!open && cantidad > 0 && (
              <span className="text-muted-foreground text-sm">
                {cantidad} {cantidad === 1 ? 'actividad' : 'actividades'}
              </span>
            )}
            {totalDia > 0 && (
              <span className="text-muted-foreground text-sm">
                {formatMoney(totalDia)}
              </span>
            )}
            <AgregarActividadDialog idViaje={idViaje} idDia={dia.id}>
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                Agregar
              </Button>
            </AgregarActividadDialog>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <div
            ref={setNodeRef}
            className={cn(
              'rounded-lg transition-colors',
              isOver && 'bg-muted/60 ring-primary/30 ring-2',
            )}
          >
            <SortableContext
              items={dia.actividades.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {dia.actividades.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-sm">
                  Arrastrá actividades acá o agregá una nueva.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dia.actividades.map((a) => (
                    <ActividadCard key={a.id} actividad={a} idViaje={idViaje} />
                  ))}
                </ul>
              )}
            </SortableContext>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------- Contenedor con DnD ----------
export function EditableItinerario({
  itinerario,
  idViaje,
  collapsed,
  onToggleCollapse,
}: {
  itinerario: Itinerario;
  idViaje: number;
  collapsed: Set<number>;
  onToggleCollapse: (idDia: number) => void;
}) {
  const mover = useMoverActividad(idViaje);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const todas = itinerario.dias.flatMap((d) => d.actividades);
  const activa = todas.find((a) => a.id === activeId) ?? null;

  function diaDeActividad(id: number) {
    return itinerario.dias.find((d) => d.actividades.some((a) => a.id === id));
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const idActividad = Number(active.id);
    const origen = diaDeActividad(idActividad);
    if (!origen) return;

    // Destino: puede ser un día vacío (id "day-N") u otra actividad.
    let idDiaDestino: number;
    let index: number;
    const overId = String(over.id);
    if (overId.startsWith('day-')) {
      idDiaDestino = Number(overId.slice(4));
      const destino = itinerario.dias.find((d) => d.id === idDiaDestino);
      index = destino ? destino.actividades.length : 0;
    } else {
      const overNum = Number(over.id);
      const destino = diaDeActividad(overNum);
      if (!destino) return;
      idDiaDestino = destino.id;
      index = destino.actividades.findIndex((a) => a.id === overNum);
    }

    const orden = index + 1;

    // Si no cambia nada, no llamamos al backend.
    const posActual = origen.actividades.findIndex((a) => a.id === idActividad);
    if (origen.id === idDiaDestino && posActual === index) return;

    mover.mutate(
      { idActividad, idDiaDestino, orden },
      {
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : 'No se pudo mover la actividad',
          ),
      },
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="space-y-4">
        {itinerario.dias.map((dia) => (
          <DiaColumn
            key={dia.id}
            dia={dia}
            idViaje={idViaje}
            open={!collapsed.has(dia.id)}
            onToggle={() => onToggleCollapse(dia.id)}
          />
        ))}
      </div>
      <DragOverlay>
        {activa ? <ActividadCardOverlay actividad={activa} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
