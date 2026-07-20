'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Loader2,
  Plane,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  MapPin,
  Compass,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useLogin } from '@/lib/query/use-auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  email: z.string().email('Ingresá un email válido'),
  password: z.string().min(1, 'Ingresá tu contraseña'),
  rememberMe: z.boolean().optional(),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  function onSubmit(values: Values) {
    login.mutate(
      { email: values.email, password: values.password },
      {
        onSuccess: () => {
          toast.success('¡Bienvenido de nuevo!', {
            description: 'Redirigiendo a tu panel...',
          });
          router.replace(params.get('next') || '/dashboard');
        },
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : 'Credenciales incorrectas.',
          ),
      },
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      {/* Columna Izquierda: Hero Visual & Branding */}
      <div className="lg:col-span-6 space-y-8 p-4 lg:p-6 text-slate-100">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          Planificación Inteligente de Viajes
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-sky-600/20 border border-sky-500/30 text-sky-400">
              <Plane className="w-8 h-8" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-white">
              Smart Travel Planner
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
            Tu próximo destino, <br />
            <span className="bg-linear-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              perfectamente planificado.
            </span>
          </h1>

          <p className="text-slate-400 text-base leading-relaxed max-w-lg">
            Generá itinerarios día por día impulsados por IA, descubrí lugares reales con Google Places y optimizá tus recorridos sin estrés.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-1">
            <Sparkles className="w-5 h-5 text-sky-400 mb-1" />
            <p className="text-xs font-bold text-slate-200">IA por Gemini</p>
            <p className="text-[11px] text-slate-400">Itinerarios a tu medida</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-1">
            <MapPin className="w-5 h-5 text-emerald-400 mb-1" />
            <p className="text-xs font-bold text-slate-200">Lugares Reales</p>
            <p className="text-[11px] text-slate-400">Puntos verificados</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-1">
            <Compass className="w-5 h-5 text-indigo-400 mb-1" />
            <p className="text-xs font-bold text-slate-200">Rutas TSP</p>
            <p className="text-[11px] text-slate-400">Recorridos optimizados</p>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Card Formulario Login */}
      <div className="lg:col-span-6">
        <div className="bg-slate-900/90 border border-slate-800/90 backdrop-blur-2xl p-8 lg:p-10 rounded-3xl shadow-2xl space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              Iniciar Sesión
            </h2>
            <p className="text-sm text-slate-400">
              Ingresá tus credenciales para acceder a tus viajes.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-200">Correo Electrónico</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <Input
                          type="email"
                          placeholder="nombre@ejemplo.com"
                          autoComplete="email"
                          className="pl-10 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 focus:border-sky-500 focus:ring-sky-500/20 h-11"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-slate-200">Contraseña</FormLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pl-10 pr-10 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 focus:border-sky-500 focus:ring-sky-500/20 h-11"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0 pt-1">
                    <FormControl>
                      <Checkbox
                        id="rememberMe"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <label
                      htmlFor="rememberMe"
                      className="text-xs text-slate-400 cursor-pointer select-none"
                    >
                      Recordar mi sesión en este dispositivo
                    </label>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-sky-500/20 gap-2 transition-all duration-200 mt-2"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Ingresar a mi cuenta
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <p className="text-sm text-slate-400">
              ¿Todavía no tenés una cuenta?{' '}
              <Link
                href="/register"
                className="text-sky-400 hover:text-sky-300 font-semibold transition-colors inline-flex items-center gap-1"
              >
                Registrate ahora
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <div className="lg:col-span-6 space-y-6">
        <Skeleton className="h-12 w-3/4 bg-slate-800" />
        <Skeleton className="h-24 w-full bg-slate-800" />
      </div>
      <div className="lg:col-span-6">
        <Skeleton className="h-96 w-full rounded-3xl bg-slate-900" />
      </div>
    </div>
  );
}
