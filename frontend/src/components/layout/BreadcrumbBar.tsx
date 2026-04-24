import { Link } from 'react-router-dom';
import type { BreadcrumbSegment } from './LayoutMetaContext';

interface BreadcrumbBarProps {
  segments: BreadcrumbSegment[];
}

export default function BreadcrumbBar({ segments }: BreadcrumbBarProps) {
  if (segments.length === 0) return null;

  return (
    <nav className="flex flex-wrap items-center gap-1 px-1 text-sm text-slate-300">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <span className="mx-2 font-mono text-border">/</span>
            )}
            {segment.label === '' ? (
              <span className="inline-block h-4 w-20 animate-pulse rounded-full bg-surface-3" />
            ) : isLast || !segment.to ? (
              <span className="font-medium text-slate-50">{segment.label}</span>
            ) : (
              <Link
                to={segment.to}
                className="transition-colors hover:text-primary"
              >
                {segment.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
