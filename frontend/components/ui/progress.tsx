import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800',
        className,
      )}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-sky-600 transition-all duration-300 ease-in-out dark:bg-sky-500"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  ),
);
Progress.displayName = 'Progress';
