import { WizardNuevoViaje } from '@/components/viajes/wizard-nuevo-viaje';

export const metadata = {
  title: 'Nuevo Viaje | Smart Travel Planner',
  description: 'Planificá y generá tu itinerario turístico con inteligencia artificial.',
};

export default function NuevoViajePage() {
  return (
    <div className="container max-w-4xl py-6 md:py-10">
      <WizardNuevoViaje />
    </div>
  );
}
