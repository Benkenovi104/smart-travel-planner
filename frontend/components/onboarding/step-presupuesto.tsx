'use client';

import { UseFormReturn, useWatch } from 'react-hook-form';
import { PerfilFormValues } from '@/lib/validations/perfil';
import { Card } from '@/components/ui/card';
import { Backpack, Hotel, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProps {
  form: UseFormReturn<PerfilFormValues>;
}

const PRESUPUESTOS = [
  {
    id: 'ECONOMICO' as const,
    title: 'Económico',
    emoji: '🎒',
    icon: Backpack,
    description: 'Prioridad en cuidar el bolsillo: hostels, transporte público y atracciones accesibles.',
  },
  {
    id: 'CONFORT' as const,
    title: 'Confort',
    emoji: '🏨',
    icon: Hotel,
    description: 'Equilibrio entre costo y comodidad: hoteles 3-4 estrellas y buenas experiencias gastronómicas.',
  },
  {
    id: 'PREMIUM' as const,
    title: 'Premium',
    emoji: '💎',
    icon: Gem,
    description: 'Experiencia sin restricciones: hoteles boutique, tours privados y restaurantes destacados.',
  },
];

export function StepPresupuesto({ form }: StepProps) {
  const selected = useWatch({ control: form.control, name: 'presupuestoPreferido' });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          ¿Cuál es tu nivel de presupuesto preferido?
        </h2>
        <p className="text-sm text-slate-400">
          Nos servirá de guía al sugerir hospedajes, restaurantes y atracciones.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {PRESUPUESTOS.map((item) => {
          const isSelected = selected === item.id;
          const Icon = item.icon;

          return (
            <Card
              key={item.id}
              onClick={() =>
                form.setValue('presupuestoPreferido', item.id, { shouldValidate: true })
              }
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

      {form.formState.errors.presupuestoPreferido && (
        <p className="text-xs font-medium text-red-400 text-center">
          {form.formState.errors.presupuestoPreferido.message}
        </p>
      )}
    </div>
  );
}
