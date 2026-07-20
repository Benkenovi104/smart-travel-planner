import { Metadata } from 'next';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export const metadata: Metadata = {
  title: 'Onboarding de Perfil | Smart Travel Planner',
  description: 'Configurá tus preferencias de viaje e intereses.',
};

export default function OnboardingPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-6 px-4 relative">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-3xl relative z-10">
        <OnboardingWizard />
      </div>
    </div>
  );
}
