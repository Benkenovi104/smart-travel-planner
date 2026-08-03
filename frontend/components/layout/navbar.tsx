'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plane, LogOut, Compass, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/query/use-auth';

const LINKS = [
  { href: '/dashboard', label: 'Mis Viajes', icon: Compass },
  { href: '/perfil', label: 'Mi Perfil', icon: User },
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
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-white group"
        >
          <div className="p-2 rounded-xl bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200">
            <Plane className="w-4 h-4" />
          </div>
          <span className="text-lg whitespace-nowrap bg-linear-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Smart Travel
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Sparkles className="w-3 h-3" />
            IA
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                // Abajo de `sm` la etiqueta se esconde y queda sólo el ícono:
                // con marca + 2 etiquetas + logout no entra a 412px y el header
                // se partía en dos líneas. Mismo criterio que "Cerrar Sesión".
                aria-label={link.label}
                title={link.label}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200 sm:px-3.5',
                  active
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900',
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            className="ml-1 gap-1.5 text-xs whitespace-nowrap text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all duration-200 sm:ml-2"
            onClick={onLogout}
            disabled={logout.isPending}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
