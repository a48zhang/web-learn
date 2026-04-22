import { useTerminalStore } from '../stores/useTerminalStore';

export default function TerminalToggle() {
  const { isOpen, setOpen } = useTerminalStore();

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed bottom-0 right-4 z-30 flex items-center gap-2 px-3 py-1.5 text-xs rounded-t border-t border-l border-r bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
    >
      <span className="w-2 h-2 rounded-full bg-zinc-600" />
      &gt;_ Terminal
    </button>
  );
}
