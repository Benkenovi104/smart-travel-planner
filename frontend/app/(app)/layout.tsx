import { Navbar } from '@/components/layout/navbar';
import { OnboardingGuard } from '@/components/onboarding/onboarding-guard';
import { AvisoVerificarEmail } from '@/components/auth/aviso-verificar-email';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <div className="min-h-svh">
        <AvisoVerificarEmail />
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </OnboardingGuard>
  );
}
