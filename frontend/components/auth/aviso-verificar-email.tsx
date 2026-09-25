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
  useCambiarEmail,
} from '@/lib/query/use-auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  codigo: z
    .string()
    .regex(/^\d{6}$/, 'Son los 6 dígitos que te llegaron por mail'),
});
type Values = z.infer<typeof schema>;

const schemaEmail = z.object({
  email: z.string().email('Ingresá un email válido'),
});
type ValoresEmail = z.infer<typeof schemaEmail>;

/**
 * Barra fija arriba mientras la cuenta no confirmó el email.
 *
 * No bloquea la navegación, pero sí todo lo que se puede hacer: el backend
 * rechaza crear un viaje y de ahí en adelante. Por eso el aviso está fijo arriba
 * y con el diálogo a un clic, en vez de escondido en el perfil.
 */
export function AvisoVerificarEmail() {
  const { data: me } = useMe();
  const [abierto, setAbierto] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const verificar = useVerificarEmail();
  const reenviar = useReenviarVerificacion();
  const cambiarEmail = useCambiarEmail();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { codigo: '' },
  });

  const formEmail = useForm<ValoresEmail>({
    resolver: zodResolver(schemaEmail),
    defaultValues: { email: '' },
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
          Confirmá tu email para empezar a planificar viajes. Te mandamos un
          código a{' '}
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

            {/* Reenviar no sirve si la dirección está mal escrita: vuelve a ir
                al mismo lado. Sin esta salida, un error de tipeo al registrarse
                deja la cuenta sin poder hacer nada. */}
            <div className="border-t pt-3">
              {corrigiendo ? (
                <Form {...formEmail}>
                  <form
                    onSubmit={formEmail.handleSubmit((v) =>
                      cambiarEmail.mutate(v.email, {
                        onSuccess: (r) => {
                          setCorrigiendo(false);
                          formEmail.reset();
                          toast.success(r.message);
                        },
                        onError: (e) =>
                          formEmail.setError('email', {
                            message:
                              e instanceof ApiError
                                ? e.message
                                : 'No se pudo cambiar el email.',
                          }),
                      }),
                    )}
                    className="space-y-2"
                  >
                    <FormField
                      control={formEmail.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="email"
                              autoComplete="email"
                              placeholder="tu@email.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="flex-1"
                        disabled={cambiarEmail.isPending}
                      >
                        {cambiarEmail.isPending && (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        )}
                        Guardar y reenviar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setCorrigiendo(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto w-full p-0 text-xs"
                  onClick={() => {
                    formEmail.reset({ email: me.email });
                    setCorrigiendo(true);
                  }}
                >
                  ¿Te equivocaste de dirección? Cambiala
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
