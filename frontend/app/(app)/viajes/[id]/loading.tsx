import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-9 w-full max-w-md rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
