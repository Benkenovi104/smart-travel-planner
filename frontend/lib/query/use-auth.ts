'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as auth from '../api/auth';

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
