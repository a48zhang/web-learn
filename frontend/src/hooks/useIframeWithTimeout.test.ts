import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useIframeWithTimeout } from './useIframeWithTimeout';

describe('useIframeWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns loading=true, error=false initially', () => {
    const { result } = renderHook(() => useIframeWithTimeout());
    expect(result.current.iframeLoading).toBe(true);
    expect(result.current.iframeError).toBe(false);
  });

  it('sets error=true after timeout if not resolved', () => {
    const { result } = renderHook(() => useIframeWithTimeout(5000));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.iframeError).toBe(true);
    expect(result.current.iframeLoading).toBe(false);
  });

  it('resolves on handleLoad without error', () => {
    const { result } = renderHook(() => useIframeWithTimeout());
    act(() => {
      result.current.handleLoad();
    });
    expect(result.current.iframeLoading).toBe(false);
    expect(result.current.iframeError).toBe(false);
  });

  it('sets error on handleError', () => {
    const { result } = renderHook(() => useIframeWithTimeout());
    act(() => {
      result.current.handleError();
    });
    expect(result.current.iframeError).toBe(true);
    expect(result.current.iframeLoading).toBe(false);
  });

  it('handleReload resets state and increments key', () => {
    const { result } = renderHook(() => useIframeWithTimeout());
    act(() => {
      result.current.handleReload();
    });
    expect(result.current.iframeKey).toBe(1);
    expect(result.current.iframeLoading).toBe(true);
    expect(result.current.iframeError).toBe(false);
  });
});
