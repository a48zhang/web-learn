import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(function SurfaceCard(
  { children, className = '', ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`glass-surface rounded-panel border border-border/80 bg-surface shadow-panel ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
});

export default SurfaceCard;
