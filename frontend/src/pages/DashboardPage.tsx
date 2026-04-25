import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { topicApi } from '../services/api';
import { getApiErrorMessage } from '../utils/errors';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';

const MAX_TOPIC_TITLE_CHARS = 30;

const normalizePrompt = (prompt: string) => prompt.replace(/\s+/g, ' ').trim();

export const buildTopicTitleFromPrompt = (prompt: string) => {
  const normalizedPrompt = normalizePrompt(prompt);
  const characters = Array.from(normalizedPrompt);
  if (characters.length <= MAX_TOPIC_TITLE_CHARS) {
    return normalizedPrompt;
  }

  return `${characters.slice(0, MAX_TOPIC_TITLE_CHARS).join('')}...`;
};

function DashboardPage() {
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creatingRef = useRef(false);

  useEffect(() => {
    setMeta({
      pageTitle: '控制台',
      breadcrumbSegments: [
        { label: '首页', to: '/dashboard' },
        { label: '控制台' },
      ],
      sideNavSlot: null,
    });
  }, [setMeta]);

  const normalizedPrompt = normalizePrompt(prompt);
  const canSubmit = Boolean(normalizedPrompt) && !isCreating;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedPrompt || creatingRef.current) {
      return;
    }

    creatingRef.current = true;
    setIsCreating(true);
    setError(null);

    try {
      const topic = await topicApi.create({
        title: buildTopicTitleFromPrompt(normalizedPrompt),
        description: normalizedPrompt,
        type: 'website',
      });

      navigate(`/topics/${topic.id}/edit`, {
        state: { initialBuildPrompt: normalizedPrompt },
      });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, '创建专题失败'));
    } finally {
      creatingRef.current = false;
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center justify-center">
        <div className="w-full">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              今天想做什么
            </h1>
          </div>

          <form
            aria-label="AI 创建专题"
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/70 bg-white/75 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-4"
          >
            <label htmlFor="dashboard-topic-prompt" className="sr-only">
              描述专题需求
            </label>
            <div className="flex items-end gap-3">
              <input
                id="dashboard-topic-prompt"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  if (error) {
                    setError(null);
                  }
                }}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="描述你想制作的专题..."
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-lg"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                aria-label="开始制作"
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                <FiArrowRight aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 px-3 text-sm text-rose-600">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
