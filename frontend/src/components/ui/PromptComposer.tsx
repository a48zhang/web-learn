import SurfaceCard from './SurfaceCard';

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitLabel: string;
}

export default function PromptComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  submitLabel,
}: PromptComposerProps) {
  return (
    <SurfaceCard className="w-full max-w-3xl p-4 sm:p-5">
      <textarea
        aria-label="描述专题需求"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-28 w-full resize-none bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500 sm:text-lg"
        placeholder="描述你想制作的专题..."
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="inline-flex items-center justify-center rounded-2xl bg-primary-strong px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        >
          {submitLabel}
        </button>
      </div>
    </SurfaceCard>
  );
}
