import { Link } from 'react-router-dom';
import type { BreadcrumbSegment } from './LayoutMetaContext';

interface BreadcrumbBarProps {
  segments: BreadcrumbSegment[];
}

export default function BreadcrumbBar({ segments }: BreadcrumbBarProps) {
  if (segments.length === 0) return null;

  return (
    <nav className="px-4 py-2 text-sm flex items-center flex-wrap gap-1 bg-white border-b border-gray-100">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-gray-400 mx-2">/</span>
            )}
            {segment.label === '' ? (
              <span className="inline-block h-4 w-20 bg-gray-200 rounded animate-pulse" />
            ) : isLast || !segment.to ? (
              <span className="text-gray-900 font-medium">{segment.label}</span>
            ) : (
              <Link
                to={segment.to}
                className="text-gray-500 hover:text-blue-600"
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
