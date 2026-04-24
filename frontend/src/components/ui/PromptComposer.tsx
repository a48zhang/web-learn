import SurfaceCard from './SurfaceCard';

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitLabel: string;
  textareaLabel?: string;
  placeholder?: string;
  className?: string;
  cardClassName?: string;
}

export default function PromptComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  submitLabel,
  textareaLabel = '描述你的需求',
  placeholder = '描述你想完成的内容...',
  className = '',
  cardClassName = '',
}: PromptComposerProps) {
  return (
    <div className={`mx-auto flex w-full justify-center px-4 sm:px-6 ${className}`.trim()}>
      <SurfaceCard className={`w-full max-w-3xl p-4 sm:p-5 ${cardClassName}`.trim()}>
        <textarea
          aria-label={textareaLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="min-h-28 w-full resize-none bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500 sm:text-lg"
          placeholder={placeholder}
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
    </div>
  );
}
