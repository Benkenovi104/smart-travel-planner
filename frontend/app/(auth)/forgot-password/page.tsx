'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { useForgotPassword } from '@/lib/query/use-auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  email: z.string().email('Ingresá un email válido'),
});
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [enviado, setEnviado] = useState(false);
  const forgot = useForgotPassword();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  function onSubmit(values: Values) {
    forgot.mutate(values.email, {
      // El backend responde igual exista o no el email. Mostramos siempre la
      // misma pantalla: decir "ese email no está registrado" filtraría qué
      // cuentas existen.
      onSuccess: () => setEnviado(true),
      onError: (e) =>
        toast.error(
          e instanceof ApiError && e.status === 429
            ? 'Demasiados intentos. Esperá un momento antes de reintentar.'
            : 'No se pudo enviar el email. Probá de nuevo en un rato.',
        ),
    });
  }

  if (enviado) {
    return (
      <Card>
        <CardHeader className="text-center">
          <MailCheck className="text-muted-foreground mx-auto size-10" />
          <CardTitle className="text-2xl">Revisá tu correo</CardTitle>
          <CardDescription>
            Si <span className="text-foreground">{form.getValues('email')}</span>{' '}
            tiene una cuenta, le enviamos un link para restablecer la contraseña.
            El link vence en una hora.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-3">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Volver a iniciar sesión</Link>
          </Button>
          <button
            type="button"
            onClick={() => setEnviado(false)}
            className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
          >
            Usar otro email
          </button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
        <CardDescription>
          Te mandamos un link para elegir una nueva.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-4">
            <Button type="submit" className="w-full" disabled={forgot.isPending}>
              {forgot.isPending && <Loader2 className="animate-spin" />}
              Enviar link
            </Button>
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="size-3.5" />
              Volver a iniciar sesión
            </Link>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
