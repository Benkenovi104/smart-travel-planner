'use client';

import { UseFormReturn } from 'react-hook-form';
import { PerfilFormValues } from '@/lib/validations/perfil';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Utensils, Accessibility } from 'lucide-react';

interface StepProps {
  form: UseFormReturn<PerfilFormValues>;
}

const DIETAS = [
  { id: 'NINGUNA', label: 'Sin preferencia dietaria particular' },
  { id: 'VEGETARIANA', label: 'Vegetariana' },
  { id: 'VEGANA', label: 'Vegana' },
  { id: 'CELIACA', label: 'Celíaca / Sin Gluten' },
  { id: 'KOSHER', label: 'Kosher' },
  { id: 'HALAL', label: 'Halal' },
];

const MOVILIDAD = [
  { id: 'NINGUNA', label: 'Sin requerimiento especial de movilidad' },
  { id: 'SILLA_DE_RUEDAS', label: 'Accesibilidad para silla de ruedas' },
  { id: 'MINIMO_RECORRIDO', label: 'Preferencia por mínimos recorridos a pie' },
];

export function StepRestricciones({ form }: StepProps) {
  const selectedDietas = form.watch('dietas') || ['NINGUNA'];
  const selectedMovilidad = form.watch('movilidad') || ['NINGUNA'];

  const toggleDieta = (id: string) => {
    let current = [...selectedDietas];
    if (id === 'NINGUNA') {
      current = ['NINGUNA'];
    } else {
      current = current.filter((item) => item !== 'NINGUNA');
      if (current.includes(id)) {
        current = current.filter((item) => item !== id);
      } else {
        current.push(id);
      }
      if (current.length === 0) current = ['NINGUNA'];
    }
    form.setValue('dietas', current, { shouldValidate: true });
  };

  const toggleMovilidad = (id: string) => {
    let current = [...selectedMovilidad];
    if (id === 'NINGUNA') {
      current = ['NINGUNA'];
    } else {
      current = current.filter((item) => item !== 'NINGUNA');
      if (current.includes(id)) {
        current = current.filter((item) => item !== id);
      } else {
        current.push(id);
      }
      if (current.length === 0) current = ['NINGUNA'];
    }
    form.setValue('movilidad', current, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Dietas y Accesibilidad
        </h2>
        <p className="text-sm text-slate-400">
          Opcional: indicanos si requerís consideración especial en gastronomía o movilidad.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Dietas */}
        <div className="space-y-4 p-5 rounded-2xl border border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 font-semibold text-white border-b border-slate-800 pb-3">
            <Utensils className="w-5 h-5 text-sky-400" />
            Preferencias Dietarias
          </div>
          <div className="space-y-3">
            {DIETAS.map((item) => {
              const isChecked = selectedDietas.includes(item.id);
              return (
                <div key={item.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`dieta-${item.id}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleDieta(item.id)}
                  />
                  <Label
                    htmlFor={`dieta-${item.id}`}
                    className="text-sm font-normal text-slate-300 cursor-pointer select-none"
                  >
                    {item.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Movilidad */}
        <div className="space-y-4 p-5 rounded-2xl border border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 font-semibold text-white border-b border-slate-800 pb-3">
            <Accessibility className="w-5 h-5 text-sky-400" />
            Accesibilidad y Movilidad
          </div>
          <div className="space-y-3">
            {MOVILIDAD.map((item) => {
              const isChecked = selectedMovilidad.includes(item.id);
              return (
                <div key={item.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`mov-${item.id}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleMovilidad(item.id)}
                  />
                  <Label
                    htmlFor={`mov-${item.id}`}
                    className="text-sm font-normal text-slate-300 cursor-pointer select-none"
                  >
                    {item.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
