'use client';

import {
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { formatFecha } from '@/lib/format';
import {
  leerSuscripcionEnCurso,
  olvidarSuscripcionEnCurso,
} from '@/lib/planes/checkout';
import { qk } from '@/lib/query/keys';
import { useEstadoSuscripcion } from '@/lib/query/use-planes';

/** Cuánto esperar la confirmación antes de avisar que puede tardar más. */
const ESPERA_MAXIMA_MS = 60_000;

const sinSuscribirse = () => () => {};

function aId(valor: string | null): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * La página a la que vuelve Mercado Pago después del pago. **No activa nada por
 * sí misma**: cualquiera puede abrir esta URL. Consulta el estado de la
 * suscripción, que el backend confirma contra la API de Mercado Pago.
 */
export default function ResultadoPagoPage() {
  // useSearchParams en una ruta estática necesita un Suspense para el build.
  return (
    <Suspense fallback={<Confirmando />}>
      <ResultadoPago />
    </Suspense>
  );
}

function ResultadoPago() {
  const params = useSearchParams();
  const guardado = useSyncExternalStore(
    sinSuscribirse,
    leerSuscripcionEnCurso,
    () => null,
  );
  const id = aId(params.get('idSuscripcion')) ?? aId(guardado);

  const [vencido, setVencido] = useState(false);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setVencido(true), ESPERA_MAXIMA_MS);
    return () => clearTimeout(t);
  }, [intento]);

  const { data, isLoading, isError, error, isFetching, refetch } =
    useEstadoSuscripcion(id, !vencido);

  const activa = data?.estado === 'ACTIVA';
  const qc = useQueryClient();
  useEffect(() => {
    if (!activa) return;
    olvidarSuscripcionEnCurso();
    // El badge, los medidores y los límites pasan a mostrar el plan nuevo.
    qc.invalidateQueries({ queryKey: qk.miPlanTodos });
  }, [activa, qc]);

  const verPlanes = (
    <Button asChild variant="outline">
      <Link href="/planes">Ver planes</Link>
    </Button>
  );

  if (id === null || (error instanceof ApiError && error.status === 404)) {
    return (
      <Estado
        icono={<XCircle className="size-12 text-slate-500" />}
        titulo="No encontramos el pago"
        texto="Si pagaste, tu plan se activa solo en unos minutos. Podés verlo en Planes."
        acciones={verPlanes}
      />
    );
  }

  if (isError) {
    return (
      <Estado
        icono={<XCircle className="size-12 text-amber-400" />}
        titulo="No pudimos consultar el pago"
        texto="Probá de nuevo en unos segundos. Si pagaste, el plan se activa igual."
        acciones={
          <Button onClick={() => void refetch()} disabled={isFetching}>
            Volver a consultar
          </Button>
        }
      />
    );
  }

  if (isLoading || !data) return <Confirmando />;

  if (activa) {
    return (
      <Estado
        icono={<CheckCircle2 className="size-12 text-emerald-400" />}
        titulo={`¡Listo! Ya tenés el plan ${data.nombrePlan}`}
        texto={`Se renueva el ${formatFecha(data.vigenteHasta)}. Podés ver o cancelar tu suscripción desde tu perfil.`}
        acciones={
          <>
            <Button asChild>
              <Link href="/dashboard">Ir al inicio</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/perfil#mi-plan">Ver mi plan</Link>
            </Button>
          </>
        }
      />
    );
  }

  if (data.estado !== 'PENDIENTE') {
    return (
      <Estado
        icono={<XCircle className="size-12 text-slate-500" />}
        titulo="Esta suscripción ya no está activa"
        texto="Podés elegir un plan de nuevo desde Planes."
        acciones={verPlanes}
      />
    );
  }

  if (data.ultimoPago?.estado === 'rejected') {
    return (
      <Estado
        icono={<XCircle className="size-12 text-red-400" />}
        titulo="Mercado Pago rechazó el pago"
        texto="No se activó ningún plan y no se te cobró. Podés intentarlo de nuevo con otro medio de pago."
        acciones={verPlanes}
      />
    );
  }

  if (!vencido) return <Confirmando />;

  return (
    <Estado
      icono={<Clock className="size-12 text-amber-400" />}
      titulo="Todavía no recibimos la confirmación"
      texto="Si completaste el pago, tu plan se activa solo apenas Mercado Pago lo confirme y podés cerrar esta página. Si no llegaste a pagar, no se te cobró nada."
      acciones={
        <>
          <Button
            disabled={isFetching}
            onClick={() => {
              setVencido(false);
              setIntento((i) => i + 1);
              void refetch();
            }}
          >
            {isFetching && <Loader2 className="size-4 animate-spin" />}
            Volver a consultar
          </Button>
          {verPlanes}
        </>
      }
    />
  );
}

function Confirmando() {
  return (
    <Estado
      icono={<Loader2 className="size-12 animate-spin text-sky-400" />}
      titulo="Confirmando tu pago con Mercado Pago…"
      texto="Suele tardar unos segundos. No hace falta que recargues la página."
    />
  );
}

function Estado({
  icono,
  titulo,
  texto,
  acciones,
}: {
  icono: ReactNode;
  titulo: string;
  texto?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="rounded-3xl border border-slate-800/80 bg-slate-900/80 shadow-xl">
        <CardContent
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 p-8 text-center"
        >
          {icono}
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            {titulo}
          </h1>
          {texto && <p className="text-sm text-slate-400">{texto}</p>}
          {acciones && (
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {acciones}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
