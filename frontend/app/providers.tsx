'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { qk } from '@/lib/query/keys';
import { borradorExistente, errorDePlan } from '@/lib/planes/errores';
import { mostrarDialogoLimite } from '@/lib/planes/dialogo-limite';
import { DialogoLimite } from '@/components/planes/dialogo-limite';
import { PRIMER_PASO } from '@/components/viajes/wizard-pasos';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [queryClient] = useState(() => {
    const qc: QueryClient = new QueryClient({
      /**
       * Un 401 leyendo datos significa que el JWT venció, es inválido o la cuenta
       * ya no existe: cerramos sesión una sola vez acá en vez de repetirlo en
       * cada pantalla.
       *
       * Va solo en las queries, no en las mutaciones: el backend también usa 401
       * para "la contraseña actual es incorrecta" (cambiar contraseña, borrar
       * cuenta), y ahí expulsar al usuario al login sería un error.
       */
      queryCache: new QueryCache({
        onError: (error) => {
          if (!(error instanceof ApiError) || error.status !== 401) return;
          if (typeof window === 'undefined') return;
          // Se lee al momento del error: el QueryClient se crea una sola vez y
          // cualquier `pathname` capturado en el closure quedaría viejo.
          const actual = window.location.pathname;
          if (actual.startsWith('/login')) return;

          qc.clear();
          toast.error('Tu sesión expiró. Iniciá sesión de nuevo.');
          router.replace(`/login?next=${encodeURIComponent(actual)}`);
        },
      }),
      /**
       * Los rechazos por plan se muestran igual en toda la app: un diálogo con el
       * plan que habilita la acción. Las pantallas no los repiten en su propio
       * toast (ver `errorManejadoGlobal`).
       *
       * Y cada acción marcada con `meta.consumePlan` refresca el uso, así los
       * medidores y contadores quedan al día sin que cada pantalla lo recuerde.
       */
      mutationCache: new MutationCache({
        onError: (error) => {
          const limite = errorDePlan(error);
          if (limite) {
            mostrarDialogoLimite(limite);
            return;
          }
          const borrador = borradorExistente(error);
          if (borrador) {
            toast.error(borrador.message, {
              action: {
                label: 'Retomar',
                onClick: () =>
                  router.push(
                    `/viajes/${borrador.idViaje}/crear?paso=${PRIMER_PASO}`,
                  ),
              },
            });
          }
        },
        onSuccess: (_data, _variables, _context, mutation) => {
          if (mutation.meta?.consumePlan) {
            qc.invalidateQueries({ queryKey: qk.miPlanTodos });
          }
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          // Reintentar un 4xx no cambia el resultado y solo retrasa el feedback.
          retry: (count, error) =>
            error instanceof ApiError && error.status < 500 ? false : count < 1,
          refetchOnWindowFocus: false,
        },
      },
    });
    return qc;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
      <DialogoLimite />
    </QueryClientProvider>
  );
}
