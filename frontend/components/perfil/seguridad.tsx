'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Trash2, KeyRound, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useChangePassword, useEliminarCuenta } from '@/lib/query/use-auth';
import { ApiError } from '@/lib/api/client';

// ---------- Cambiar contraseña ----------
const passwordSchema = z
  .object({
    password_actual: z.string().min(1, 'Requerido'),
    password_nueva: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmacion: z.string(),
  })
  .refine((v) => v.password_nueva === v.confirmacion, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmacion'],
  })
  .refine((v) => v.password_nueva !== v.password_actual, {
    message: 'La contraseña nueva tiene que ser distinta de la actual',
    path: ['password_nueva'],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

export function CambiarPassword() {
  const cambiar = useChangePassword();
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password_actual: '',
      password_nueva: '',
      confirmacion: '',
    },
  });

  function onSubmit(values: PasswordValues) {
    cambiar.mutate(
      {
        password_actual: values.password_actual,
        password_nueva: values.password_nueva,
      },
      {
        onSuccess: () => {
          toast.success('Contraseña actualizada correctamente');
          form.reset();
        },
        onError: (e) =>
          toast.error(
            e instanceof ApiError && e.status === 401
              ? 'La contraseña actual es incorrecta'
              : 'No se pudo cambiar la contraseña',
          ),
      },
    );
  }

  return (
    <Card className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-sky-400" />
          Seguridad y Contraseña
        </CardTitle>
        <CardDescription className="text-slate-400">
          Vas a seguir con la sesión iniciada en este dispositivo.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="password_actual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-200">Contraseña actual</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      className="bg-slate-950/60 border-slate-800 text-white focus:border-sky-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="password_nueva"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Contraseña nueva</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
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
                name="confirmacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Repetir contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
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
                disabled={cambiar.isPending}
              >
                {cambiar.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Actualizar Contraseña
              </Button>
            </div>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}

// ---------- Eliminar cuenta ----------
const borrarSchema = z.object({
  password: z.string().min(1, 'Ingresá tu contraseña para confirmar'),
});
type BorrarValues = z.infer<typeof borrarSchema>;

export function EliminarCuenta() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const eliminar = useEliminarCuenta();

  const form = useForm<BorrarValues>({
    resolver: zodResolver(borrarSchema),
    defaultValues: { password: '' },
  });

  function onSubmit(values: BorrarValues) {
    eliminar.mutate(values.password, {
      onSuccess: () => {
        setAbierto(false);
        toast.success('Tu cuenta fue eliminada');
        router.replace('/login');
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError && e.status === 401
            ? 'La contraseña es incorrecta'
            : 'No se pudo eliminar la cuenta',
        ),
    });
  }

  return (
    <Card className="bg-slate-900/80 border border-red-500/30 backdrop-blur-xl rounded-3xl shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-red-400 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          Zona de Peligro
        </CardTitle>
        <CardDescription className="text-slate-400">
          Se borrará tu cuenta, tu perfil y todos tus viajes guardados de forma permanente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog
          open={abierto}
          onOpenChange={(o) => {
            setAbierto(o);
            if (!o) form.reset();
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive" className="rounded-full px-6 gap-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30">
              <Trash2 className="w-4 h-4" />
              Eliminar mi cuenta definitivamente
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">¿Eliminar tu cuenta?</DialogTitle>
              <DialogDescription className="text-slate-400">
                Esta acción es permanente. Para confirmar, ingresá tu contraseña actual.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                id="form-eliminar-cuenta"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Contraseña</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          className="bg-slate-950 border-slate-800 text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-slate-400 text-xs">
                        Necesitamos tu contraseña para verificar tu identidad.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-800">
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                form="form-eliminar-cuenta"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={eliminar.isPending}
              >
                {eliminar.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Eliminar definitivamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
