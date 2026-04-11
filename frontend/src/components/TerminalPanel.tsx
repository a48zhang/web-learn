import { useRef, useEffect, useCallback } from 'react';
import { useTerminalStore } from '../stores/useTerminalStore';
import { useTerminal } from '../hooks/useTerminal';

export default function TerminalPanel() {
  const { isOpen, setOpen, height, setHeight } = useTerminalStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const { open: openTerminal, close, resize } = useTerminal({
    visible: isOpen,
    containerRef,
  });

  useEffect(() => {
    if (isOpen) {
      openTerminal();
    } else {
      close();
    }
  }, [isOpen, openTerminal, close]);

  useEffect(() => {
    if (isOpen) {
      resize();
    }
  }, [isOpen, height, resize]);

  // Drag resize logic
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = dragStartY.current - moveEvent.clientY;
      const newHeight = Math.max(150, Math.min(window.innerHeight * 0.5, dragStartHeight.current + delta));
      setHeight(newHeight);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, setHeight]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 bg-zinc-900 border-t border-zinc-700"
      style={{ height: `${height}px` }}
    >
      {/* Resize handle / header */}
      <div
        className="flex items-center justify-between px-3 py-1 bg-zinc-800 border-b border-zinc-700 cursor-row-resize select-none"
        onMouseDown={handleMouseDown}
      >
        <span className="text-zinc-400 text-xs font-medium">&gt;_ Terminal</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-zinc-300 text-xs"
        >
          ✕
        </button>
      </div>
      {/* Terminal container */}
      <div ref={containerRef} className="w-full h-[calc(100%-28px)]" />
    </div>
  );
}
