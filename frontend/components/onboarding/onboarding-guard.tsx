'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { data } = useQuery<{ completado: boolean }>({
    queryKey: ['perfil-status'],
    queryFn: async () => {
      const res = await fetch('/api/perfil/me/status');
      if (!res.ok) return { completado: true };
      return res.json();
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data && data.completado === false && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [data, pathname, router]);

  return <>{children}</>;
}
