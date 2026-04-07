import type { BreadcrumbSegment } from '../components/layout/LayoutMetaContext';

/**
 * Base breadcrumb segments for all pages under the /topics hierarchy.
 * Returns a new array each time to prevent accidental mutation.
 */
export function getBaseBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: '首页', to: '/dashboard' },
    { label: '专题列表', to: '/topics' },
  ];
}
