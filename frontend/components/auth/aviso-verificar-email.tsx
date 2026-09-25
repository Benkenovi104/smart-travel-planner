'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, MailWarning } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { useMe } from '@/lib/query/use-usuario';
import {
  useVerificarEmail,
  useReenviarVerificacion,
} from '@/lib/query/use-auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  codigo: z
    .string()
    .regex(/^\d{6}$/, 'Son los 6 dígitos que te llegaron por mail'),
});
type Values = z.infer<typeof schema>;

/**
 * Barra fija arriba mientras la cuenta no confirmó el email.
 *
 * No bloquea la navegación a propósito: el usuario puede entrar, mirar y crear
 * un viaje sin verificar. Lo que el backend corta son las acciones que gastan
 * plata (generar itinerario, buscar vuelos y alojamiento), así que el aviso
 * tiene que estar a mano pero sin ser un muro.
 */
export function AvisoVerificarEmail() {
  const { data: me } = useMe();
  const [abierto, setAbierto] = useState(false);
  const verificar = useVerificarEmail();
  const reenviar = useReenviarVerificacion();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { codigo: '' },
  });

  // Mientras `me` no cargó no se muestra nada: un banner que aparece y
  // desaparece en cada navegación es peor que esperar medio segundo.
  if (!me || me.emailVerificado) return null;

  function onSubmit(values: Values) {
    verificar.mutate(values.codigo, {
      onSuccess: (r) => {
        setAbierto(false);
        form.reset();
        toast.success(r.message);
      },
      onError: (e) =>
        form.setError('codigo', {
          message:
            e instanceof ApiError
              ? e.message
              : 'No se pudo verificar. Probá de nuevo.',
        }),
    });
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
        <MailWarning className="size-4 shrink-0 text-amber-500" />
        <p className="flex-1 min-w-48">
          Confirmá tu email para generar itinerarios y buscar vuelos. Te
          mandamos un código a{' '}
          <span className="font-medium">{me.email}</span>.
        </p>

        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              Ingresar código
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirmá tu email</DialogTitle>
              <DialogDescription>
                Escribí el código de 6 dígitos que enviamos a {me.email}. Vence
                a las 24 horas.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="codigo"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="000000"
                          className="text-center text-2xl tracking-[0.5em]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={verificar.isPending}
                >
                  {verificar.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Verificar
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={reenviar.isPending}
                  onClick={() =>
                    reenviar.mutate(undefined, {
                      onSuccess: (r) => toast.success(r.message),
                      onError: (e) =>
                        toast.error(
                          e instanceof ApiError && e.status === 429
                            ? 'Esperá un momento antes de pedir otro.'
                            : 'No se pudo reenviar el código.',
                        ),
                    })
                  }
                >
                  {reenviar.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  No me llegó, mandame otro
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
