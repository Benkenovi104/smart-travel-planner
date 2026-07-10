'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

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
          toast.success('Contraseña actualizada');
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
    <Card>
      <CardHeader>
        <CardTitle>Contraseña</CardTitle>
        <CardDescription>
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
                  <FormLabel>Contraseña actual</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
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
                    <FormLabel>Contraseña nueva</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
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
                    <FormLabel>Repetir contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={cambiar.isPending}>
                {cambiar.isPending && <Loader2 className="animate-spin" />}
                Cambiar contraseña
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
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Eliminar cuenta</CardTitle>
        <CardDescription>
          Se borran tu perfil y todos tus viajes con sus itinerarios. No se puede
          deshacer.
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
            <Button variant="destructive">
              <Trash2 className="size-4" />
              Eliminar mi cuenta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
              <DialogDescription>
                Esta acción es permanente. Confirmá con tu contraseña.
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
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Te pedimos la contraseña para asegurarnos de que sos vos.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button
                type="submit"
                form="form-eliminar-cuenta"
                variant="destructive"
                disabled={eliminar.isPending}
              >
                {eliminar.isPending && <Loader2 className="animate-spin" />}
                Eliminar definitivamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
