import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SaveIndicator from './SaveIndicator';
import { useEditorStore } from '../../stores/useEditorStore';

describe('SaveIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    });

    useEditorStore.setState({
      files: { 'src/app.ts': 'console.log("hello");' },
      hasUnsavedChanges: true,
      lastSavedAt: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores a structured snapshot payload with a timestamp', async () => {
    render(<SaveIndicator topicId="topic-1" />);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'snapshot-topic-1',
      expect.stringContaining('"files"')
    );

    const raw = vi.mocked(localStorage.setItem).mock.calls[0]?.[1] ?? '';
    expect(JSON.parse(raw)).toEqual({
      files: { 'src/app.ts': 'console.log("hello");' },
      timestamp: expect.any(Number),
    });
  });
});
