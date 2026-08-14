'use client';

import { UseFormReturn, useWatch } from 'react-hook-form';
import { PerfilFormValues } from '@/lib/validations/perfil';
import { Card } from '@/components/ui/card';
import { Zap, Scale, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProps {
  form: UseFormReturn<PerfilFormValues>;
}

const RITMOS = [
  {
    id: 'MARATONICO' as const,
    title: 'Maratónico',
    emoji: '⚡',
    icon: Zap,
    description: 'Aprovechar cada minuto al máximo, visitando muchos lugares por día.',
  },
  {
    id: 'EQUILIBRADO' as const,
    title: 'Equilibrado',
    emoji: '⚖️',
    icon: Scale,
    description: 'Mezcla ideal entre recorrer lugares destacados y tiempo para descansar.',
  },
  {
    id: 'RELAX' as const,
    title: 'Relax',
    emoji: '🧘',
    icon: Heart,
    description: 'Pocos puntos por día, ritmo tranquilo sin prisas ni horarios estrictos.',
  },
];

export function StepRitmo({ form }: StepProps) {
  const selected = useWatch({ control: form.control, name: 'ritmoPreferido' });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          ¿Cuál es tu ritmo de viaje habitual?
        </h2>
        <p className="text-sm text-slate-400">
          Esto nos ayuda a calcular la cantidad de actividades diarias en tus itinerarios.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {RITMOS.map((item) => {
          const isSelected = selected === item.id;
          const Icon = item.icon;

          return (
            <Card
              key={item.id}
              onClick={() => form.setValue('ritmoPreferido', item.id, { shouldValidate: true })}
              className={cn(
                'relative p-6 cursor-pointer transition-all duration-200 border-2 hover:shadow-xl hover:-translate-y-1',
                isSelected
                  ? 'border-sky-500 bg-sky-500/10 text-white ring-2 ring-sky-500/20'
                  : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-950/80',
              )}
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="text-4xl mb-1">{item.emoji}</div>
                <div className="font-bold text-lg text-white flex items-center gap-2">
                  <Icon className="w-5 h-5 text-sky-400" />
                  {item.title}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      {form.formState.errors.ritmoPreferido && (
        <p className="text-xs font-medium text-red-400 text-center">
          {form.formState.errors.ritmoPreferido.message}
        </p>
      )}
    </div>
  );
}
