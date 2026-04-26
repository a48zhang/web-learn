import { useState } from 'react';
import SurfaceCard from './SurfaceCard';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import { AGENT_MODELS } from '../../agent/modelOptions';

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
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
  selectedModel,
  onModelChange,
  disabled = false,
  submitDisabled = false,
  submitLabel,
  textareaLabel = '描述你的需求',
  placeholder = '描述你想完成的内容...',
  className = '',
  cardClassName = '',
}: PromptComposerProps & { submitDisabled?: boolean }) {
  const isSubmitDisabled = disabled || submitDisabled;
  const currentModel = AGENT_MODELS.find((model) => model.id === selectedModel) ?? AGENT_MODELS[0];
  const showModelSelect = Boolean(selectedModel && onModelChange);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);

  const handleModelChange = (model: string) => {
    onModelChange?.(model);
    setIsModelPickerOpen(false);
  };

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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isSubmitDisabled) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="mt-3 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {showModelSelect ? (
            <div className="relative">
              <button
                type="button"
                disabled={disabled}
                aria-label="选择模型"
                aria-haspopup="listbox"
                aria-expanded={isModelPickerOpen}
                onClick={() => setIsModelPickerOpen((open) => !open)}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl border border-sky-400/20 bg-slate-950/70 px-3 py-2 text-left shadow-[0_14px_40px_rgba(14,165,233,0.12)] transition-colors hover:border-sky-300/40 hover:bg-slate-900/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-[260px]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white">
                  <img src={currentModel.logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-sky-300">
                    当前模型
                  </span>
                  <span className="block truncate text-sm font-semibold text-slate-50">{currentModel.label}</span>
                </span>
                <FiChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isModelPickerOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {isModelPickerOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="关闭模型选择"
                    onClick={() => setIsModelPickerOpen(false)}
                    tabIndex={-1}
                  />
                  <div
                    role="listbox"
                    aria-label="选择模型"
                    className="absolute bottom-[calc(100%+10px)] left-0 z-50 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-1.5 text-left shadow-[0_24px_70px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:bottom-auto sm:top-[calc(100%+10px)] sm:w-[330px]"
                  >
                    <div className="mt-1 flex flex-col gap-1">
                      {AGENT_MODELS.map((model) => {
                        const isActive = model.id === currentModel.id;

                        return (
                          <button
                            key={model.id}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => handleModelChange(model.id)}
                            className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              isActive
                                ? 'border-sky-400/40 bg-sky-500/15 text-slate-50'
                                : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5'
                            }`}
                          >
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white p-0.5">
                              <img src={model.logoUrl} alt="" className="h-full w-full rounded-lg object-contain" loading="lazy" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-sm font-semibold">
                                <span className="truncate">{model.label}</span>
                                {isActive ? <FiCheck className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" /> : null}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-slate-400">{model.desc}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={isSubmitDisabled}
            onClick={onSubmit}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary-strong px-5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          >
            {showModelSelect ? <FiCheck className="h-4 w-4" aria-hidden="true" /> : null}
            {submitLabel}
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}
