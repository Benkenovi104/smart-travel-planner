import { z } from 'zod';

export const perfilSchema = z.object({
  ritmoPreferido: z.enum(['MARATONICO', 'EQUILIBRADO', 'RELAX'], {
    message: 'Seleccioná un ritmo de viaje.',
  }),
  presupuestoPreferido: z.enum(['ECONOMICO', 'CONFORT', 'PREMIUM'], {
    message: 'Seleccioná un nivel de presupuesto.',
  }),
  dietas: z.array(z.string()).optional(),
  movilidad: z.array(z.string()).optional(),
  interesesIds: z
    .array(z.number())
    .min(1, 'Seleccioná al menos 1 interés de la lista.'),
});

export type PerfilFormValues = z.infer<typeof perfilSchema>;
