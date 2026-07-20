'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Loader2,
  Plane,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useRegister } from '@/lib/query/use-auth';
import { ApiError } from '@/lib/api/client';

const schema = z.object({
  nombre: z.string().min(1, 'Ingresá tu nombre').max(100),
  apellido: z.string().min(1, 'Ingresá tu apellido').max(100),
  email: z.string().email('Ingresá un email válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(72),
});
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', apellido: '', email: '', password: '' },
  });

  function onSubmit(values: Values) {
    register.mutate(values, {
      onSuccess: () => {
        toast.success('¡Cuenta creada con éxito!', {
          description: 'A continuación completá tu perfil de viajero.',
        });
        router.replace('/onboarding');
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : 'No se pudo crear la cuenta.',
        ),
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      {/* Columna Izquierda: Branding Hero */}
      <div className="lg:col-span-5 space-y-6 p-4 lg:p-6 text-slate-100">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          Registro de Usuario
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-sky-600/20 border border-sky-500/30 text-sky-400">
              <Plane className="w-8 h-8" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-white">
              Smart Travel Planner
            </span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
            Creá tu cuenta en segundos
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed">
            Una vez ingresados tus datos, configurarás tu Perfil de Viajero obligatorio para personalizar tus itinerarios inteligentes.
          </p>
        </div>
      </div>

      {/* Columna Derecha: Card Formulario Registro */}
      <div className="lg:col-span-7">
        <div className="bg-slate-900/90 border border-slate-800/90 backdrop-blur-2xl p-8 lg:p-10 rounded-3xl shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Crear tu cuenta
            </h2>
            <p className="text-sm text-slate-400">
              Paso 1 de 2: Datos personales para tu usuario.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Nombre</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          <Input
                            autoComplete="given-name"
                            placeholder="Juan"
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
                  name="apellido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Apellido</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          <Input
                            autoComplete="family-name"
                            placeholder="Pérez"
                            className="pl-10 bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 focus:border-sky-500 focus:ring-sky-500/20 h-11"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                          placeholder="tu@email.com"
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
                    <FormLabel className="text-slate-200">Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mínimo 8 caracteres"
                          autoComplete="new-password"
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

              <Button
                type="submit"
                className="w-full h-11 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-sky-500/20 gap-2 transition-all duration-200 mt-2"
                disabled={register.isPending}
              >
                {register.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    Continuar al Perfil de Viajero
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <p className="text-sm text-slate-400">
              ¿Ya tenés una cuenta registrada?{' '}
              <Link
                href="/login"
                className="text-sky-400 hover:text-sky-300 font-semibold transition-colors"
              >
                Iniciá sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
