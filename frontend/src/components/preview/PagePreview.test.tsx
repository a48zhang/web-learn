import type { ComponentType } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PagePreview } from './PagePreview';

describe('PagePreview', () => {
  it('renders the live preview iframe when WebContainer is ready', () => {
    const Preview = PagePreview as unknown as ComponentType<{
      previewUrl: string | null;
      isReady: boolean;
      error: string | null;
      onRefresh?: () => void;
    }>;

    render(
      <Preview
        previewUrl="https://preview.example"
        isReady
        error={null}
      />
    );

    expect(screen.getByTitle('Page Preview')).toHaveAttribute('src', 'https://preview.example');
  });

  it('surfaces a retry action when preview startup fails', () => {
    const onRefresh = vi.fn();
    const Preview = PagePreview as unknown as ComponentType<{
      previewUrl: string | null;
      isReady: boolean;
      error: string | null;
      onRefresh?: () => void;
    }>;

    render(
      <Preview
        previewUrl={null}
        isReady={false}
        error="boot failed"
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
