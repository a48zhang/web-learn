import { useTerminalStore } from '../stores/useTerminalStore';

export default function TerminalToggle() {
  const { isOpen, setOpen } = useTerminalStore();

  return (
    <button
      type="button"
      onClick={() => setOpen(!isOpen)}
      className={`fixed bottom-1 right-4 z-30 flex items-center gap-2 px-3 py-1 text-xs rounded-t border-t border-l border-r ${
        isOpen
          ? 'bg-zinc-800 border-zinc-600 text-blue-400'
          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-400' : 'bg-zinc-600'}`} />
      &gt;_ Terminal
    </button>
  );
}
