'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useResetPassword } from '@/lib/query/use-auth';
import { ApiError } from '@/lib/api/client';

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmacion: z.string(),
  })
  .refine((v) => v.password === v.confirmacion, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmacion'],
  });
type Values = z.infer<typeof schema>;

/** `useSearchParams` obliga a un límite de Suspense para que prerenderice. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const reset = useResetPassword();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmacion: '' },
  });

  if (!token) return <TokenInvalido />;

  function onSubmit(values: Values) {
    reset.mutate(
      { token: token!, password_nueva: values.password },
      {
        onSuccess: () => {
          toast.success('Contraseña actualizada. Ya podés iniciar sesión.');
          router.replace('/login');
        },
        onError: (e) =>
          toast.error(
            e instanceof ApiError && e.status === 400
              ? 'El link venció o ya se usó. Pedí uno nuevo.'
              : 'No se pudo restablecer la contraseña.',
          ),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Nueva contraseña</CardTitle>
        <CardDescription>Elegí una contraseña para tu cuenta.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="password"
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
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" className="w-full" disabled={reset.isPending}>
              {reset.isPending && <Loader2 className="animate-spin" />}
              Restablecer contraseña
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function TokenInvalido() {
  return (
    <Card>
      <CardHeader className="text-center">
        <TriangleAlert className="text-muted-foreground mx-auto size-10" />
        <CardTitle className="text-2xl">Link inválido</CardTitle>
        <CardDescription>
          Este link no tiene token. Pedí uno nuevo desde &quot;Recuperar
          contraseña&quot;.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button className="w-full" asChild>
          <Link href="/forgot-password">Pedir un link nuevo</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function ResetSkeleton() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Nueva contraseña</CardTitle>
        <CardDescription>Elegí una contraseña para tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
      <CardFooter className="mt-6">
        <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
  );
}
