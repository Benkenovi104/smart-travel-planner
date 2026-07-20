import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          className={cn(
            'peer h-5 w-5 shrink-0 appearance-none rounded-md border border-slate-300 bg-white checked:border-sky-600 checked:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:checked:border-sky-500 dark:checked:bg-sky-500 cursor-pointer',
            className,
          )}
          {...props}
        />
        <Check className="pointer-events-none absolute left-0.5 top-0.5 hidden h-4 w-4 text-white peer-checked:block" />
      </div>
    );
  },
);
Checkbox.displayName = 'Checkbox';
