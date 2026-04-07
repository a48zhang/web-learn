import { useEffect, useRef, useState } from 'react';

// 15 seconds — long enough for most sites to start loading within iframe
const IFRAME_TIMEOUT_MS = 15_000;

interface UseIframeWithTimeoutResult {
  iframeLoading: boolean;
  iframeError: boolean;
  iframeKey: number;
  handleLoad: () => void;
  handleError: () => void;
  handleReload: () => void;
}

export function useIframeWithTimeout(
  timeoutMs: number = IFRAME_TIMEOUT_MS,
  sourceUrl?: string,
): UseIframeWithTimeoutResult {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeTimeoutRef = useRef<number | null>(null);

  // Start timeout when hook mounts or sourceUrl/iframeKey changes
  useEffect(() => {
    setIframeLoading(true);
    setIframeError(false);
    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
    iframeTimeoutRef.current = window.setTimeout(() => {
      setIframeLoading(false);
      setIframeError(true);
    }, timeoutMs);
    return () => {
      if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
    };
  }, [sourceUrl, iframeKey, timeoutMs]);

  const handleLoad = () => {
    setIframeLoading(false);
    setIframeError(false);
    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
  };

  const handleError = () => {
    setIframeLoading(false);
    setIframeError(true);
    if (iframeTimeoutRef.current) window.clearTimeout(iframeTimeoutRef.current);
  };

  const handleReload = () => {
    setIframeLoading(true);
    setIframeError(false);
    setIframeKey((k) => k + 1);
  };

  return { iframeLoading, iframeError, iframeKey, handleLoad, handleError, handleReload };
}
