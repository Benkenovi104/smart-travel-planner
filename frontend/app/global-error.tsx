'use client';

import './globals.css';

/**
 * Último recurso: solo se activa si falla el root layout, y en ese caso
 * reemplaza al layout entero. Por eso define su propio <html>/<body> y no usa
 * componentes de la app (podrían depender de providers que no llegaron a montar).
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body className="bg-background text-foreground">
        <title>Error — Smart Travel Planner</title>
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            La aplicación no pudo cargar. Reintentá en unos segundos.
          </p>
          {error.digest && (
            <p className="text-muted-foreground/70 font-mono text-xs">
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
