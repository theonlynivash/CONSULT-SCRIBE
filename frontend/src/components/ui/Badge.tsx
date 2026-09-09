import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success';
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  const variantStyles = {
    default: 'bg-amber-100 text-amber-900 border-amber-300',
    secondary: 'bg-gray-100 text-gray-800 border-gray-200',
    outline: 'border-current text-current',
    destructive: 'bg-red-100 text-red-800 border-red-200',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
