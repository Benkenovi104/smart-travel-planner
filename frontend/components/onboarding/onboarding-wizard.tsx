'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { perfilSchema, PerfilFormValues } from '@/lib/validations/perfil';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { StepRitmo } from './step-ritmo';
import { StepPresupuesto } from './step-presupuesto';
import { StepIntereses } from './step-intereses';
import { StepRestricciones } from './step-restricciones';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plane } from 'lucide-react';

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  const form = useForm<PerfilFormValues>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      ritmoPreferido: 'EQUILIBRADO',
      presupuestoPreferido: 'CONFORT',
      dietas: ['NINGUNA'],
      movilidad: ['NINGUNA'],
      interesesIds: [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: PerfilFormValues) => {
      const res = await fetch('/api/perfil/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al guardar tu perfil.');
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidad y actualizar inmediatamente la caché para que el Guard no rebote al dashboard
      queryClient.setQueryData(['perfil-status'], { completado: true });
      queryClient.invalidateQueries({ queryKey: ['perfil-status'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });

      toast.success('¡Perfil configurado con éxito!', {
        description: 'Ya podés empezar a crear tus viajes optimizados.',
      });
      router.replace('/dashboard');
    },
    onError: (error: Error) => {
      toast.error('Ocurrió un error', {
        description: error.message,
      });
    },
  });

  const handleNext = async () => {
    let isValid = false;

    if (currentStep === 1) {
      isValid = await form.trigger('ritmoPreferido');
    } else if (currentStep === 2) {
      isValid = await form.trigger('presupuestoPreferido');
    } else if (currentStep === 3) {
      isValid = await form.trigger('interesesIds');
    } else if (currentStep === 4) {
      isValid = await form.trigger();
    }

    if (isValid) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep((prev) => prev + 1);
      } else {
        form.handleSubmit((data) => mutation.mutate(data))();
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const progressPercent = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div className="w-full space-y-8 p-6 md:p-10 bg-slate-900/90 border border-slate-800/90 backdrop-blur-2xl rounded-3xl shadow-2xl text-slate-100">
      {/* Header Wizard */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-lg text-white">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Plane className="w-5 h-5" />
            </div>
            Configuración de tu Perfil de Viajero
          </div>
          <span className="text-xs font-semibold text-sky-400 bg-sky-500/10 px-3.5 py-1 rounded-full border border-sky-500/20">
            Paso {currentStep} de {TOTAL_STEPS}
          </span>
        </div>

        <Progress value={progressPercent} className="h-2 bg-slate-800" />
      </div>

      {/* Form Steps */}
      <div className="min-h-85 flex flex-col justify-between py-2">
        {currentStep === 1 && <StepRitmo form={form} />}
        {currentStep === 2 && <StepPresupuesto form={form} />}
        {currentStep === 3 && <StepIntereses form={form} />}
        {currentStep === 4 && <StepRestricciones form={form} />}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-800/80">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 1 || mutation.isPending}
          className="gap-2 border-slate-800 text-slate-300 hover:bg-slate-800 rounded-full px-5"
        >
          <ArrowLeft className="w-4 h-4" />
          Anterior
        </Button>

        <Button
          type="button"
          onClick={handleNext}
          disabled={mutation.isPending}
          className="gap-2 bg-linear-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-medium shadow-lg shadow-sky-500/20 rounded-full px-6"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : currentStep === TOTAL_STEPS ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Finalizar Configuración
            </>
          ) : (
            <>
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
