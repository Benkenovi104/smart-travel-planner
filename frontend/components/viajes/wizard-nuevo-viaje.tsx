'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  MapPin,
  Calendar as CalendarIcon,
  User,
  Heart,
  Users,
  UserPlus,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  DollarSign,
  Minus,
  Plus,
  Star,
  CheckCircle2,
  Save,
  Plane,
  BedDouble,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { CiudadAutocomplete } from './ciudad-autocomplete';
import { VuelosSection } from '@/components/reservas/vuelos-section';
import { AlojamientoSection } from '@/components/reservas/alojamiento-section';
import { useCrearViaje, useActualizarViaje } from '@/lib/query/use-viajes';
import { useGenerarItinerario } from '@/lib/query/use-itinerario';
import { useIntereses } from '@/lib/query/use-usuario';
import { usePerfilMe } from '@/lib/query/use-perfil';
import { ApiError } from '@/lib/api/client';
import type { Viaje } from '@/lib/types/models';

// Esquema de Zod para el Wizard
const wizardSchema = z
  .object({
    origen: z.string().min(1, 'Ingresá el lugar de origen').max(255),
    destino_principal: z.string().min(1, 'Ingresá el destino principal').max(255),
    fecha_inicio: z.string().min(1, 'Seleccioná la fecha de inicio'),
    fecha_fin: z.string().min(1, 'Seleccioná la fecha de fin'),
    cantidad_personas: z.number().min(1, 'Mínimo 1 persona'),
    presupuesto_total: z.number().min(0).optional(),
  })
  .refine((d) => d.fecha_fin >= d.fecha_inicio, {
    message: 'La fecha de fin debe ser igual o posterior al inicio',
    path: ['fecha_fin'],
  });

type WizardFormValues = z.infer<typeof wizardSchema>;

// Opciones de Acompañante
const ACOMPANANTES = [
  { id: 'SOLO', titulo: 'Solo', desc: '1 viajero', personas: 1, icon: User },
  { id: 'PAREJA', titulo: 'En Pareja', desc: '2 personas', personas: 2, icon: Heart },
  { id: 'FAMILIA', titulo: 'En Familia', desc: '4+ personas', personas: 4, icon: Users },
  { id: 'AMIGOS', titulo: 'Con Amigos', desc: '3+ personas', personas: 3, icon: UserPlus },
] as const;

// Sugerencia de presupuestos según el Perfil
const PRESUPUESTOS_SUGERIDOS: Record<string, number> = {
  ECONOMICO: 1000,
  CONFORT: 2500,
  PREMIUM: 5000,
  económico: 1000,
  moderado: 2500,
  premium: 5000,
  lujo: 10000,
};

// Mensajes rotativos para el Loading de IA
const MENSAJES_IA = [
  '✨ Conectando con Google Gemini IA...',
  '📍 Buscando atracciones icónicas y lugares únicos...',
  '🗺️ Diseñando itinerario optimizado día por día...',
  '⏱️ Calculando tiempos de traslado y distancias...',
  '🎉 ¡Casi listo! Finalizando los detalles de tu viaje...',
];

export function WizardNuevoViaje() {
  const router = useRouter();

  const [paso, setPaso] = useState<number>(1);
  const [tipoAcompanante, setTipoAcompanante] = useState<string>('PAREJA');
  const [interesesSeleccionados, setInteresesSeleccionados] = useState<Set<number>>(new Set());
  const [cargandoIA, setCargandoIA] = useState<boolean>(false);
  const [indiceMensaje, setIndiceMensaje] = useState<number>(0);
  const [creandoBorradorBff, setCreandoBorradorBff] = useState<boolean>(false);

  // Queries & Mutations
  const { data: perfil } = usePerfilMe();
  const { data: todosIntereses } = useIntereses();
  const crearViaje = useCrearViaje();
  const [viajeCreado, setViajeCreado] = useState<Viaje | null>(null);

  const viajeIdActual = viajeCreado?.id ?? 0;
  const actualizarViaje = useActualizarViaje(viajeIdActual);
  const generarItinerario = useGenerarItinerario(viajeIdActual);

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      origen: '',
      destino_principal: '',
      fecha_inicio: '',
      fecha_fin: '',
      cantidad_personas: 2,
      presupuesto_total: 2500,
    },
  });

  const [origen, destinoPrincipal, cantidadPersonas, fechaInicio, fechaFin] = useWatch({
    control: form.control,
    name: ['origen', 'destino_principal', 'cantidad_personas', 'fecha_inicio', 'fecha_fin'],
  });

  // Precarga Inteligente desde el Perfil
  useEffect(() => {
    if (!perfil) return;

    if (perfil.presupuestoPreferido && PRESUPUESTOS_SUGERIDOS[perfil.presupuestoPreferido]) {
      form.setValue('presupuesto_total', PRESUPUESTOS_SUGERIDOS[perfil.presupuestoPreferido]);
    }

    if (perfil.intereses && perfil.intereses.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInteresesSeleccionados(new Set(perfil.intereses.map((i) => i.id_interes)));
    }
  }, [perfil, form]);

  // Rotador de mensajes durante la pantalla de carga IA
  useEffect(() => {
    if (!cargandoIA) return;
    const interval = setInterval(() => {
      setIndiceMensaje((prev) => (prev + 1) % MENSAJES_IA.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [cargandoIA]);

  const perfilInteresIds = new Set(perfil?.intereses?.map((i) => i.id_interes) ?? []);

  function aplicarPresetFechas(dias: number) {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() + 1);

    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + dias - 1);

    const formatISO = (d: Date) => d.toISOString().split('T')[0];
    form.setValue('fecha_inicio', formatISO(inicio));
    form.setValue('fecha_fin', formatISO(fin));
  }

  function toggleInteres(id: number) {
    setInteresesSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Asegura la creación del borrador en BD para poder buscar Vuelos / Alojamiento
  async function asegurarBorradorCreado(): Promise<Viaje | null> {
    if (viajeCreado) return viajeCreado;
    const ok = await form.trigger();
    if (!ok) return null;

    setCreandoBorradorBff(true);
    const values = form.getValues();
    const payload = {
      origen: values.origen,
      destino_principal: values.destino_principal,
      fecha_inicio: values.fecha_inicio,
      fecha_fin: values.fecha_fin,
      cantidad_personas: values.cantidad_personas,
      presupuesto_total: values.presupuesto_total,
      intereses: interesesSeleccionados.size ? [...interesesSeleccionados] : undefined,
    };

    try {
      const nuevoViaje = await crearViaje.mutateAsync(payload);
      setViajeCreado(nuevoViaje);
      setCreandoBorradorBff(false);
      return nuevoViaje;
    } catch (e) {
      setCreandoBorradorBff(false);
      toast.error(e instanceof ApiError ? e.message : 'No se pudo crear el borrador del viaje');
      return null;
    }
  }

  // Avanzar entre los 4 pasos
  async function irAlSiguientePaso() {
    if (paso === 1) {
      const ok = await form.trigger(['origen', 'destino_principal', 'fecha_inicio', 'fecha_fin']);
      if (!ok) return;
      setPaso(2);
    } else if (paso === 2) {
      const ok = await form.trigger(['cantidad_personas']);
      if (!ok) return;
      setPaso(3);
    } else if (paso === 3) {
      const ok = await form.trigger(['presupuesto_total']);
      if (!ok) return;
      
      // Al pasar al paso 4 de Vuelos & Alojamiento, creamos el borrador si no fue creado aún
      const v = await asegurarBorradorCreado();
      if (v) setPaso(4);
    }
  }

  function irAlPasoAnterior() {
    if (paso > 1) setPaso((prev) => prev - 1);
  }

  // Guardar Borrador únicamente
  async function guardarBorrador() {
    const v = await asegurarBorradorCreado();
    if (v) {
      toast.success('Viaje guardado como borrador');
      router.replace(`/viajes/${v.id}`);
    }
  }

  // Crear Viaje + Generar Itinerario con IA ✨
  async function generarConIA() {
    const ok = await form.trigger();
    if (!ok) return;

    let targetViaje = viajeCreado;
    setCargandoIA(true);

    if (!targetViaje) {
      const values = form.getValues();
      const payload = {
        origen: values.origen,
        destino_principal: values.destino_principal,
        fecha_inicio: values.fecha_inicio,
        fecha_fin: values.fecha_fin,
        cantidad_personas: values.cantidad_personas,
        presupuesto_total: values.presupuesto_total,
        intereses: interesesSeleccionados.size ? [...interesesSeleccionados] : undefined,
      };

      try {
        targetViaje = await crearViaje.mutateAsync(payload);
        setViajeCreado(targetViaje);
      } catch (e) {
        setCargandoIA(false);
        toast.error(e instanceof ApiError ? e.message : 'No se pudo crear el viaje');
        return;
      }
    }

    // Disparar generación con IA
    generarItinerario.mutate(undefined, {
      onSuccess: () => {
        actualizarViaje.mutate(
          { estado: 'planificado' },
          {
            onSuccess: () => {
              toast.success('✨ ¡Itinerario inteligente creado!');
              router.replace(`/viajes/${targetViaje!.id}`);
            },
            onError: () => {
              router.replace(`/viajes/${targetViaje!.id}`);
            },
          },
        );
      },
      onError: (e) => {
        setCargandoIA(false);
        toast.error(
          e instanceof ApiError
            ? e.message
            : 'No se pudo generar el itinerario por IA. El viaje quedó guardado.',
        );
        router.replace(`/viajes/${targetViaje!.id}`);
      },
    });
  }

  // -------------------------------------------------------------
  // RENDER: Pantalla de Carga Mágica con IA (Loading)
  // -------------------------------------------------------------
  if (cargandoIA) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center space-y-8 animate-in fade-in zoom-in duration-300">
        <Card className="relative overflow-hidden border-primary/20 bg-linear-to-b from-primary/5 via-background to-background p-8 shadow-2xl">
          <div className="absolute -top-12 -left-12 size-36 bg-primary/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute -bottom-12 -right-12 size-36 bg-purple-500/10 rounded-full blur-2xl animate-pulse" />

          <div className="flex justify-center mb-6">
            <div className="relative flex items-center justify-center size-20 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
              <Sparkles className="size-10 animate-spin text-primary" style={{ animationDuration: '6s' }} />
              <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping opacity-40" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Creando tu Viaje Mágico
            </h2>
            <p className="text-muted-foreground text-sm font-medium h-8 transition-all duration-500">
              {MENSAJES_IA[indiceMensaje]}
            </p>
          </div>

          <div className="mt-8 space-y-2">
            <Progress value={((indiceMensaje + 1) / MENSAJES_IA.length) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Esto toma solo unos segundos. No cierres la página.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Contenedor Principal del Wizard (Pasos 1 a 4)
  // -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header & Volver */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="size-4 mr-1" />
          Volver
        </Button>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Paso {paso} de 4
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={(paso / 4) * 100} className="h-2" />
        <div className="grid grid-cols-4 text-center text-xs text-muted-foreground font-medium px-1">
          <span className={cn(paso >= 1 && 'text-primary font-semibold')}>1. Destino & Fechas</span>
          <span className={cn(paso >= 2 && 'text-primary font-semibold')}>2. Compañía</span>
          <span className={cn(paso >= 3 && 'text-primary font-semibold')}>3. Presupuesto</span>
          <span className={cn(paso >= 4 && 'text-primary font-semibold')}>4. Reservas</span>
        </div>
      </div>

      {/* Card Contenedora de Formulario */}
      <Card className="shadow-lg border-muted/80">
        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()}>
            {/* -------------------------------------------------------------
                PASO 1: DESTINO Y FECHAS
               ------------------------------------------------------------- */}
            {paso === 1 && (
              <div className="space-y-6 p-6 animate-in fade-in duration-200">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <MapPin className="size-6 text-primary" />
                    ¿A dónde querés viajar?
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Elegí el origen, el destino principal y las fechas de tu aventura.
                  </CardDescription>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="origen"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lugar de Origen</FormLabel>
                        <FormControl>
                          <CiudadAutocomplete
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Ej: Buenos Aires, Argentina"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="destino_principal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destino Principal</FormLabel>
                        <FormControl>
                          <CiudadAutocomplete
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Ej: Bariloche, Argentina"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Presets Rápidos de Duración */}
                <div className="space-y-2 pt-2">
                  <FormLabel className="text-xs text-muted-foreground uppercase font-semibold">
                    Presets de fechas rápidas
                  </FormLabel>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarPresetFechas(3)}
                      className="text-xs"
                    >
                      ⚡ Fin de semana (3 días)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarPresetFechas(7)}
                      className="text-xs"
                    >
                      🌴 1 Semana (7 días)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => aplicarPresetFechas(14)}
                      className="text-xs"
                    >
                      ✈️ 2 Semanas (14 días)
                    </Button>
                  </div>
                </div>

                {/* Fechas Inicio / Fin */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fecha_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <CalendarIcon className="size-4 text-muted-foreground" />
                          Fecha de Inicio
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fecha_fin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <CalendarIcon className="size-4 text-muted-foreground" />
                          Fecha de Fin
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                PASO 2: COMPAÑÍA Y ESTILO
               ------------------------------------------------------------- */}
            {paso === 2 && (
              <div className="space-y-6 p-6 animate-in fade-in duration-200">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Users className="size-6 text-primary" />
                    ¿Con quién viajás y qué buscás?
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Definí los acompañantes y personalizá los intereses de este viaje.
                  </CardDescription>
                </div>

                {/* Cards de Acompañante */}
                <div className="space-y-2">
                  <FormLabel>Tipo de Compañía</FormLabel>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {ACOMPANANTES.map((ac) => {
                      const Icon = ac.icon;
                      const seleccionado = tipoAcompanante === ac.id;
                      return (
                        <div
                          key={ac.id}
                          onClick={() => {
                            setTipoAcompanante(ac.id);
                            form.setValue('cantidad_personas', ac.personas);
                          }}
                          className={cn(
                            'cursor-pointer rounded-xl border-2 p-3 text-center transition-all hover:border-primary/50',
                            seleccionado
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-muted bg-card',
                          )}
                        >
                          <Icon className={cn('mx-auto size-6 mb-2', seleccionado ? 'text-primary' : 'text-muted-foreground')} />
                          <p className="font-semibold text-sm">{ac.titulo}</p>
                          <p className="text-xs text-muted-foreground">{ac.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stepper Numérico para cantidad de personas */}
                <FormField
                  control={form.control}
                  name="cantidad_personas"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Cantidad de Personas Exacta</FormLabel>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => field.onChange(Math.max(1, field.value - 1))}
                          disabled={field.value <= 1}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-12 text-center text-lg font-bold">
                          {field.value}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => field.onChange(field.value + 1)}
                        >
                          <Plus className="size-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground ml-2">
                          {field.value === 1 ? 'viajero' : 'viajeros en total'}
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tags de Intereses con precarga del perfil */}
                <div className="space-y-3 pt-2">
                  <div>
                    <FormLabel>Intereses para este viaje</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Los marcados con <Star className="inline size-3 text-amber-500 fill-amber-500" /> se cargaron automáticamente de tu perfil.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {todosIntereses?.map((i) => {
                      const activo = interesesSeleccionados.has(i.id);
                      const esDelPerfil = perfilInteresIds.has(i.id);

                      return (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => toggleInteres(i.id)}
                        >
                          <Badge
                            variant={activo ? 'default' : 'outline'}
                            className={cn(
                              'cursor-pointer py-1.5 px-3 capitalize text-xs gap-1.5 transition-all',
                              activo && 'shadow-sm',
                              !activo && 'hover:bg-muted',
                            )}
                          >
                            {esDelPerfil && <Star className="size-3 text-amber-400 fill-amber-400" />}
                            {i.nombre}
                            {activo && <CheckCircle2 className="size-3 ml-0.5" />}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                PASO 3: PRESUPUESTO
               ------------------------------------------------------------- */}
            {paso === 3 && (
              <div className="space-y-6 p-6 animate-in fade-in duration-200">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <DollarSign className="size-6 text-primary" />
                    Presupuesto Estimado
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Establecé tu presupuesto total proyectado para sugerirte opciones acordes a tu plan.
                  </CardDescription>
                </div>

                {/* Input de Presupuesto con formato */}
                <FormField
                  control={form.control}
                  name="presupuesto_total"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Presupuesto Total Estimado ($ USD)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={0}
                            className="pl-9 text-lg font-semibold"
                            placeholder="2500"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Ajustes rápidos de presupuesto */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue('presupuesto_total', 1000)}
                    className="text-xs"
                  >
                    $1,000 (Económico)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue('presupuesto_total', 2500)}
                    className="text-xs"
                  >
                    $2,500 (Confort)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue('presupuesto_total', 5000)}
                    className="text-xs"
                  >
                    $5,000 (Premium)
                  </Button>
                </div>

                {/* Resumen interactivo previo a la Logística */}
                <div className="rounded-xl border bg-primary/5 p-4 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
                    <Sparkles className="size-4" />
                    Resumen del Viaje
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <strong>Origen:</strong> {origen || 'No definido'}
                    </div>
                    <div>
                      <strong>Destino:</strong> {destinoPrincipal || 'No definido'}
                    </div>
                    <div>
                      <strong>Viajeros:</strong> {cantidadPersonas} persona(s)
                    </div>
                    <div>
                      <strong>Fechas:</strong> {fechaInicio} al {fechaFin}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                PASO 4: VUELOS & ALOJAMIENTO (RESERVAS & LOGÍSTICA CENTRAL)
               ------------------------------------------------------------- */}
            {paso === 4 && (
              <div className="space-y-6 p-6 animate-in fade-in duration-200">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Plane className="size-6 text-primary" />
                    <Building2 className="size-6 text-primary" />
                    Vuelos & Alojamiento
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Buscá y elegí tu transporte y hospedaje en tiempo real. También podés saltar este paso y resolverlo más adelante.
                  </CardDescription>
                </div>

                {creandoBorradorBff ? (
                  <div className="py-12 text-center space-y-3">
                    <Sparkles className="mx-auto size-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Conectando con servicios de reserva...
                    </p>
                  </div>
                ) : viajeCreado ? (
                  <Tabs defaultValue="vuelos" className="w-full space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="vuelos" className="gap-2">
                        <Plane className="size-4" /> Vuelos Sugeridos
                      </TabsTrigger>
                      <TabsTrigger value="alojamiento" className="gap-2">
                        <BedDouble className="size-4" /> Hospedaje Sugerido
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="vuelos" className="pt-2">
                      <VuelosSection idViaje={viajeCreado.id} />
                    </TabsContent>
                    <TabsContent value="alojamiento" className="pt-2">
                      <AlojamientoSection idViaje={viajeCreado.id} viaje={viajeCreado} />
                    </TabsContent>
                  </Tabs>
                ) : null}
              </div>
            )}

            {/* -------------------------------------------------------------
                FOOTER Y BOTONES DE NAVEGACIÓN
               ------------------------------------------------------------- */}
            <div className="flex items-center justify-between border-t p-6 bg-muted/10 rounded-b-xl gap-3">
              {paso > 1 ? (
                <Button type="button" variant="outline" onClick={irAlPasoAnterior}>
                  <ArrowLeft className="size-4 mr-1" />
                  Atrás
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={guardarBorrador} disabled={crearViaje.isPending}>
                  <Save className="size-4 mr-1" />
                  Guardar borrador
                </Button>
              )}

              {paso < 4 ? (
                <Button type="button" onClick={irAlSiguientePaso}>
                  Siguiente
                  <ArrowRight className="size-4 ml-1" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={guardarBorrador} disabled={crearViaje.isPending}>
                    Guardar borrador
                  </Button>
                  <Button
                    type="button"
                    onClick={generarConIA}
                    disabled={crearViaje.isPending || generarItinerario.isPending}
                    className="bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-md"
                  >
                    <Sparkles className="size-4 mr-1.5 animate-pulse" />
                    Generar Itinerario con IA ✨
                  </Button>
                </div>
              )}
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
