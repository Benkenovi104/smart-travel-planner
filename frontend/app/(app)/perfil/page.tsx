'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useMe,
  useActualizarMe,
  useGuardarPerfil,
  useIntereses,
  useMisIntereses,
  useAgregarInteres,
  useQuitarInteres,
} from '@/lib/query/use-usuario';
import { CambiarPassword, EliminarCuenta } from '@/components/perfil/seguridad';
import { ApiError } from '@/lib/api/client';
import type {
  PresupuestoPreferido,
  RitmoPreferido,
  TipoViajero,
} from '@/lib/types/models';

const RITMOS: RitmoPreferido[] = ['relajado', 'moderado', 'intenso'];
const PRESUPUESTOS: PresupuestoPreferido[] = [
  'económico',
  'moderado',
  'premium',
  'lujo',
];
const TIPOS: TipoViajero[] = ['solo', 'pareja', 'familia', 'grupo', 'negocios'];

function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

export default function PerfilPage() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="text-muted-foreground text-sm">
          Tus datos y preferencias de viaje.
        </p>
      </div>

      <DatosPersonales
        nombre={me?.nombre ?? ''}
        apellido={me?.apellido ?? ''}
        email={me?.email ?? ''}
      />
      <PerfilViajeroForm
        ritmo={me?.perfil?.ritmo ?? ''}
        presupuesto={me?.perfil?.presupuesto ?? ''}
        tipo={me?.perfil?.tipoViajero ?? ''}
      />
      <InteresesSection />
      <CambiarPassword />
      <EliminarCuenta />
    </div>
  );
}

// ---------- Datos personales ----------
const datosSchema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  apellido: z.string().min(1, 'Requerido').max(100),
});

function DatosPersonales({
  nombre,
  apellido,
  email,
}: {
  nombre: string;
  apellido: string;
  email: string;
}) {
  const actualizar = useActualizarMe();
  const form = useForm<z.infer<typeof datosSchema>>({
    resolver: zodResolver(datosSchema),
    values: { nombre, apellido },
  });

  function onSubmit(values: z.infer<typeof datosSchema>) {
    actualizar.mutate(values, {
      onSuccess: () => toast.success('Datos actualizados'),
      onError: (e) => toast.error(errMsg(e, 'No se pudieron guardar los datos')),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos personales</CardTitle>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="apellido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apellido</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={actualizar.isPending || !form.formState.isDirty}
              >
                {actualizar.isPending && <Loader2 className="animate-spin" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}

// ---------- Perfil de viajero ----------
function PerfilViajeroForm({
  ritmo,
  presupuesto,
  tipo,
}: {
  ritmo: string;
  presupuesto: string;
  tipo: string;
}) {
  const guardar = useGuardarPerfil();
  const form = useForm<{
    ritmo_preferido: string;
    presupuesto_preferido: string;
    tipo_viajero: string;
  }>({
    values: {
      ritmo_preferido: ritmo,
      presupuesto_preferido: presupuesto,
      tipo_viajero: tipo,
    },
  });

  function onSubmit(values: {
    ritmo_preferido: string;
    presupuesto_preferido: string;
    tipo_viajero: string;
  }) {
    guardar.mutate(
      {
        ...(values.ritmo_preferido && {
          ritmo_preferido: values.ritmo_preferido as RitmoPreferido,
        }),
        ...(values.presupuesto_preferido && {
          presupuesto_preferido:
            values.presupuesto_preferido as PresupuestoPreferido,
        }),
        ...(values.tipo_viajero && {
          tipo_viajero: values.tipo_viajero as TipoViajero,
        }),
      },
      {
        onSuccess: () => toast.success('Perfil de viajero actualizado'),
        onError: (e) => toast.error(errMsg(e, 'No se pudo guardar el perfil')),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil de viajero</CardTitle>
        <CardDescription>
          Ayuda a la IA a personalizar tus itinerarios.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                control={form.control}
                name="ritmo_preferido"
                label="Ritmo"
                options={RITMOS}
              />
              <SelectField
                control={form.control}
                name="presupuesto_preferido"
                label="Presupuesto habitual"
                options={PRESUPUESTOS}
              />
              <SelectField
                control={form.control}
                name="tipo_viajero"
                label="Tipo de viajero"
                options={TIPOS}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={guardar.isPending || !form.formState.isDirty}
              >
                {guardar.isPending && <Loader2 className="animate-spin" />}
                Guardar
              </Button>
            </div>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}

// Campo Select reutilizable ligado a RHF.
function SelectField({
  control,
  name,
  label,
  options,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  name: string;
  label: string;
  options: readonly string[];
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value || ''}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí…" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o} className="capitalize">
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  );
}

// ---------- Intereses ----------
function InteresesSection() {
  const { data: catalogo } = useIntereses();
  const { data: mis } = useMisIntereses();
  const agregar = useAgregarInteres();
  const quitar = useQuitarInteres();

  const misIds = new Set((mis ?? []).map((i) => i.id));
  const disponibles = (catalogo ?? []).filter((i) => !misIds.has(i.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intereses generales</CardTitle>
        <CardDescription>
          Se aplican a todos tus viajes (podés priorizar otros por viaje).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Tus intereses
          </p>
          {mis && mis.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Todavía no agregaste ninguno.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {mis?.map((i) => (
              <Badge key={i.id} variant="default" className="gap-1 capitalize">
                {i.nombre}
                <button
                  type="button"
                  onClick={() => quitar.mutate(i.id)}
                  className="hover:text-destructive-foreground -mr-1 ml-0.5"
                  aria-label={`Quitar ${i.nombre}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {disponibles.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Agregar
            </p>
            <div className="flex flex-wrap gap-2">
              {disponibles.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => agregar.mutate({ id: i.id })}
                  disabled={agregar.isPending}
                >
                  <Badge
                    variant="outline"
                    className="hover:bg-muted cursor-pointer gap-1 capitalize"
                  >
                    <Plus className="size-3" />
                    {i.nombre}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
