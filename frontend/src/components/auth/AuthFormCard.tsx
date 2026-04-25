import type { ReactNode } from 'react';
import SurfaceCard from '../ui/SurfaceCard';

interface AuthFormCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

export default function AuthFormCard({ title, subtitle, children }: AuthFormCardProps) {
  return (
    <SurfaceCard className="w-full p-6 sm:p-8">
      <div className="flex flex-col">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-50">{title}</h1>
          {subtitle && <div className="text-sm text-slate-400">{subtitle}</div>}
        </div>
        {children}
      </div>
    </SurfaceCard>
  );
}
