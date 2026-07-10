'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as auth from '../api/auth';
import * as usuarios from '../api/usuarios';

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: auth.login,
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: auth.register,
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: auth.logout,
    onSuccess: () => qc.clear(),
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: auth.forgotPassword });
}

export function useResetPassword() {
  return useMutation({ mutationFn: auth.resetPassword });
}

export function useChangePassword() {
  return useMutation({ mutationFn: auth.changePassword });
}

/**
 * Borra la cuenta. El backend no puede invalidar la cookie httpOnly (la setea el
 * BFF), así que después del borrado pegamos a /api/auth/logout para limpiarla:
 * sin eso quedaría una cookie con el JWT de un usuario que ya no existe.
 */
export function useEliminarCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) => {
      await usuarios.deleteMe(password);
      await auth.logout();
    },
    onSuccess: () => qc.clear(),
  });
}
