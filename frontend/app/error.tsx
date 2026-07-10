'use client'; // Los error boundaries tienen que ser Client Components.

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Boundary de las rutas de la app. En Next 16 la prop para reintentar es
 * `unstable_retry` (vuelve a hacer el fetch y re-renderiza el segmento);
 * `reset` sigue existiendo pero solo limpia el estado sin refetchear.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 text-center">
      <TriangleAlert className="text-muted-foreground size-10" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Ocurrió un error inesperado. Podés reintentar; si sigue pasando, volvé
          al inicio.
        </p>
        {error.digest && (
          <p className="text-muted-foreground/70 font-mono text-xs">
            {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => unstable_retry()}>
          <RotateCw className="size-4" />
          Reintentar
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Ir a mis viajes</Link>
        </Button>
      </div>
    </div>
  );
}
