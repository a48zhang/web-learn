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

  it('does not clear unsaved changes after local snapshot debounce', async () => {
    render(<SaveIndicator topicId="topic-1" />);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(useEditorStore.getState().hasUnsavedChanges).toBe(true);
  });
});
