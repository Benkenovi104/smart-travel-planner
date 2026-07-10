import Link from 'next/link';
import { Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <Compass className="text-muted-foreground size-10" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Esta página no existe</h1>
        <p className="text-muted-foreground text-sm">
          Puede que el link esté mal o que el viaje se haya eliminado.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Ir a mis viajes</Link>
      </Button>
    </div>
  );
}
