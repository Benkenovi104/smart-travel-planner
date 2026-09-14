import { useSyncExternalStore } from 'react';
import type { ErrorDePlan } from './errores';

/**
 * Estado del diálogo de límite de plan. Vive fuera de React a propósito: lo abre
 * el `MutationCache` del `QueryClient`, que no es un componente y no puede usar
 * hooks ni contexto.
 */
let actual: ErrorDePlan | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  for (const oyente of oyentes) oyente();
}

export function mostrarDialogoLimite(detalle: ErrorDePlan) {
  actual = detalle;
  avisar();
}

export function cerrarDialogoLimite() {
  actual = null;
  avisar();
}

export function useDialogoLimite(): ErrorDePlan | null {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
    () => actual,
    () => null,
  );
}
