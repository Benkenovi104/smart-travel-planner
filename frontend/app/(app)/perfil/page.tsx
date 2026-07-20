'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, X, User, Sparkles, Heart } from 'lucide-react';

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

const RITMOS = ['EQUILIBRADO', 'MARATONICO', 'RELAX'] as const;
const PRESUPUESTOS = ['CONFORT', 'ECONOMICO', 'PREMIUM'] as const;
const TIPOS: TipoViajero[] = ['solo', 'pareja', 'familia', 'grupo', 'negocios'];

function errMsg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

export default function PerfilPage() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-3xl bg-slate-900" />
        <Skeleton className="h-48 w-full rounded-3xl bg-slate-900" />
        <Skeleton className="h-48 w-full rounded-3xl bg-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-linear-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800/80 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold">
            <User className="w-3.5 h-3.5" />
            Ajustes de Cuenta
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Mi Perfil de Usuario
          </h1>
          <p className="text-slate-400 text-sm max-w-lg">
            Administrá tus datos personales, preferencias de viaje e intereses turísticos.
          </p>
        </div>
      </div>

      <DatosPersonales
        nombre={me?.nombre ?? ''}
        apellido={me?.apellido ?? ''}
        email={me?.email ?? ''}
      />
      <PerfilViajeroForm
        ritmo={me?.perfil?.ritmo ?? ''}
        presupuesto={me?.perfil?.presupuesto ?? ''}
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
      onSuccess: () => toast.success('Datos personales actualizados'),
      onError: (e) => toast.error(errMsg(e, 'No se pudieron guardar los datos')),
    });
  }

  return (
    <Card className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-sky-400" />
          Datos Personales
        </CardTitle>
        <CardDescription className="text-slate-400">{email}</CardDescription>
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
                    <FormLabel className="text-slate-200">Nombre</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-slate-950/60 border-slate-800 text-white focus:border-sky-500"
                        {...field}
                      />
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
                    <FormLabel className="text-slate-200">Apellido</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-slate-950/60 border-slate-800 text-white focus:border-sky-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white rounded-full px-6"
                disabled={actualizar.isPending || !form.formState.isDirty}
              >
                {actualizar.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Guardar Cambios
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
}: {
  ritmo: string;
  presupuesto: string;
}) {
  const guardar = useGuardarPerfil();
  const form = useForm<{
    ritmo_preferido: string;
    presupuesto_preferido: string;
  }>({
    values: {
      ritmo_preferido: ritmo,
      presupuesto_preferido: presupuesto,
    },
  });

  function onSubmit(values: {
    ritmo_preferido: string;
    presupuesto_preferido: string;
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
      },
      {
        onSuccess: () => toast.success('Perfil de viajero actualizado'),
        onError: (e) => toast.error(errMsg(e, 'No se pudo guardar el perfil')),
      },
    );
  }

  return (
    <Card className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-sky-400" />
          Preferencias de Viaje
        </CardTitle>
        <CardDescription className="text-slate-400">
          Guía a la Inteligencia Artificial al generar tus itinerarios.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="ritmo_preferido"
                label="Ritmo habitual"
                options={RITMOS}
              />
              <SelectField
                control={form.control}
                name="presupuesto_preferido"
                label="Presupuesto habitual"
                options={PRESUPUESTOS}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white rounded-full px-6"
                disabled={guardar.isPending || !form.formState.isDirty}
              >
                {guardar.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Guardar Preferencias
              </Button>
            </div>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}

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
          <FormLabel className="text-slate-200">{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value || ''}>
            <FormControl>
              <SelectTrigger className="w-full bg-slate-950/60 border-slate-800 text-white focus:border-sky-500">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              {options.map((o) => (
                <SelectItem key={o} value={o} className="capitalize hover:bg-slate-800 focus:bg-slate-800 text-slate-200">
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
    <Card className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <Heart className="w-5 h-5 text-sky-400" />
          Intereses Generales
        </CardTitle>
        <CardDescription className="text-slate-400">
          Actividades favoritas asociadas por defecto a tu perfil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-slate-400 mb-3 text-xs font-semibold uppercase tracking-wider">
            Tus Intereses Seleccionados
          </p>
          {mis && mis.length === 0 && (
            <p className="text-slate-500 text-sm italic">
              Todavía no seleccionaste ninguno.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {mis?.map((i) => (
              <Badge
                key={i.id}
                className="bg-sky-600/20 text-sky-300 border border-sky-500/30 px-3 py-1.5 rounded-full text-xs font-medium gap-1.5 capitalize"
              >
                {i.nombre}
                <button
                  type="button"
                  onClick={() => quitar.mutate(i.id)}
                  className="hover:text-red-400 transition-colors"
                  aria-label={`Quitar ${i.nombre}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {disponibles.length > 0 && (
          <div>
            <p className="text-slate-400 mb-3 text-xs font-semibold uppercase tracking-wider">
              Agregar del Catálogo
            </p>
            <div className="flex flex-wrap gap-2">
              {disponibles.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => agregar.mutate({ id: i.id })}
                  disabled={agregar.isPending}
                  className="transition-transform hover:scale-105"
                >
                  <Badge
                    variant="outline"
                    className="bg-slate-950/40 border-slate-800 text-slate-300 hover:border-sky-500 hover:text-sky-400 px-3 py-1.5 rounded-full text-xs gap-1.5 capitalize cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-sky-400" />
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
