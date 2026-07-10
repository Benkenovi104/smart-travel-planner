'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Compass, LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/query/use-auth';

const LINKS = [
  { href: '/dashboard', label: 'Mis viajes' },
  { href: '/perfil', label: 'Perfil' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();

  function onLogout() {
    logout.mutate(undefined, {
      onSettled: () => router.replace('/login'),
    });
  }

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-6">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <Compass className="size-5 shrink-0" />
          {/* En pantallas chicas el nombre completo empuja al resto fuera. */}
          <span className="hidden sm:inline">Smart Travel Planner</span>
          <span className="sm:hidden">STP</span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-2 py-1.5 text-sm transition-colors sm:px-3',
                  active
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0"
          onClick={onLogout}
          disabled={logout.isPending}
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  );
}
