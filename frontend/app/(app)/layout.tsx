import { Navbar } from '@/components/layout/navbar';
import { OnboardingGuard } from '@/components/onboarding/onboarding-guard';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <div className="min-h-svh">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </div>
    </OnboardingGuard>
  );
}
