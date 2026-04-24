import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { topicApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import PromptComposer from '../components/ui/PromptComposer';
import AuthDialog from '../components/auth/AuthDialog';
import AuthFormCard from '../components/auth/AuthFormCard';

const MAX_TOPIC_TITLE_CHARS = 30;

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
});

const registerSchema = z.object({
  username: z.string().min(2, '用户名至少需要2个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

type AuthMode = 'login' | 'register';
type AuthIntent = 'create' | null;
type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

const normalizePrompt = (prompt: string) => prompt.replace(/\s+/g, ' ').trim();

const buildTopicTitleFromPrompt = (prompt: string) => {
  const normalizedPrompt = normalizePrompt(prompt);
  const characters = Array.from(normalizedPrompt);
  if (characters.length <= MAX_TOPIC_TITLE_CHARS) {
    return normalizedPrompt;
  }

  return `${characters.slice(0, MAX_TOPIC_TITLE_CHARS).join('')}...`;
};

function PublicHomePage() {
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    login,
    register,
  } = useAuthStore();
  const [prompt, setPrompt] = useState('');
  const [dialogMode, setDialogMode] = useState<AuthMode | null>(null);
  const [authIntent, setAuthIntent] = useState<AuthIntent>(null);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const creatingRef = useRef(false);

  useEffect(() => {
    setMeta({
      pageTitle: 'WebLearn',
      breadcrumbSegments: [],
      sideNavSlot: null,
    });
  }, [setMeta]);

  useEffect(() => {
    if (isAuthenticated && authIntent !== 'create') {
      navigate('/dashboard', { replace: true });
    }
  }, [authIntent, isAuthenticated, navigate]);

  const normalizedPrompt = normalizePrompt(prompt);
  const composerDisabled = !normalizedPrompt || isCreating || isAuthLoading;

  const createTopicFromPrompt = async (nextPrompt: string) => {
    if (!nextPrompt || creatingRef.current) {
      return;
    }

    creatingRef.current = true;
    setIsCreating(true);
    setCreateError(null);

    try {
      const topic = await topicApi.create({
        title: buildTopicTitleFromPrompt(nextPrompt),
        description: nextPrompt,
        type: 'website',
      });

      navigate(`/topics/${topic.id}/edit`, {
        state: { initialBuildPrompt: nextPrompt },
      });
    } catch (err: unknown) {
      setCreateError(getApiErrorMessage(err, '创建专题失败'));
    } finally {
      creatingRef.current = false;
      setIsCreating(false);
    }
  };

  const openAuthDialog = (
    mode: AuthMode,
    intent: AuthIntent = null,
    nextQueuedPrompt?: string
  ) => {
    setDialogMode(mode);
    setAuthIntent(intent);
    setCreateError(null);
    if (intent === 'create' && nextQueuedPrompt) {
      setQueuedPrompt(nextQueuedPrompt);
      return;
    }

    setQueuedPrompt(null);
  };

  const closeAuthDialog = () => {
    setDialogMode(null);
    setAuthIntent(null);
    setQueuedPrompt(null);
  };

  const handlePromptSubmit = async () => {
    if (!normalizedPrompt) {
      return;
    }

    if (isAuthenticated) {
      await createTopicFromPrompt(normalizedPrompt);
      return;
    }

    openAuthDialog('register', 'create', normalizedPrompt);
  };

  const handleAuthSuccess = async () => {
    const shouldContinueCreate = authIntent === 'create' && Boolean(queuedPrompt);
    const nextPrompt = shouldContinueCreate ? queuedPrompt : null;
    setDialogMode(null);

    if (nextPrompt) {
      await createTopicFromPrompt(nextPrompt);
      return;
    }

    setAuthIntent(null);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] text-slate-100">
      <header className="px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
          <Link to="/" className="font-display text-lg font-semibold tracking-[0.18em] text-slate-50">
            WebLearn
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAuthDialog('login')}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-50"
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => openAuthDialog('register')}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-primary-soft"
            >
              注册
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-5.5rem)] items-center px-4 pb-10 pt-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
          <div className="mb-8 max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-primary">
              Prompt To Topic
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
              从一句需求开始创建互动专题
            </h1>
            <p className="mt-4 text-base text-slate-300 sm:text-lg">
              输入你想做的专题方向，登录后立即进入编辑器继续生成和修改。
            </p>
          </div>

          <div className="w-full max-w-3xl">
            <PromptComposer
              value={prompt}
              onChange={(value) => {
                setPrompt(value);
                if (createError) {
                  setCreateError(null);
                }
              }}
              onSubmit={() => {
                void handlePromptSubmit();
              }}
              disabled={composerDisabled}
              submitLabel={isCreating ? '创建中...' : '开始创建'}
              textareaLabel="描述专题需求"
              placeholder="例如：做一个中国古代史互动专题，包含时间线、地图和关键人物故事"
              cardClassName="border border-white/10 bg-slate-900/80 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl"
            />
            {createError ? (
              <p role="alert" className="mt-3 text-center text-sm text-rose-300">
                {createError}
              </p>
            ) : null}
          </div>
        </div>
      </main>

      <AuthFlowDialog
        mode={dialogMode}
        isLoading={isAuthLoading}
        onClose={closeAuthDialog}
        onModeChange={setDialogMode}
        onSuccess={handleAuthSuccess}
        onLogin={login}
        onRegister={register}
      />
    </div>
  );
}

interface AuthFlowDialogProps {
  mode: AuthMode | null;
  isLoading: boolean;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSuccess: () => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (username: string, email: string, password: string) => Promise<void>;
}

function AuthFlowDialog({
  mode,
  isLoading,
  onClose,
  onModeChange,
  onSuccess,
  onLogin,
  onRegister,
}: AuthFlowDialogProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode) {
      setError(null);
    }
  }, [mode]);

  const handleLogin = async (data: LoginFormValues) => {
    setError(null);
    try {
      await onLogin(data.email, data.password);
      toast.success('登录成功！');
      await onSuccess();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, '登录失败，请检查您的邮箱和密码');
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleRegister = async (data: RegisterFormValues) => {
    setError(null);
    try {
      await onRegister(data.username, data.email, data.password);
      toast.success('注册成功！');
      await onSuccess();
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, '注册失败，请稍后重试');
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <AuthDialog isOpen={mode !== null} mode={mode ?? 'login'} onClose={onClose}>
      {mode === 'login' ? (
        <LoginDialogCard
          error={error}
          isLoading={isLoading}
          onSubmit={handleLogin}
          onSwitchToRegister={() => onModeChange('register')}
        />
      ) : mode === 'register' ? (
        <RegisterDialogCard
          error={error}
          isLoading={isLoading}
          onSubmit={handleRegister}
          onSwitchToLogin={() => onModeChange('login')}
        />
      ) : null}
    </AuthDialog>
  );
}

interface LoginDialogCardProps {
  error: string | null;
  isLoading: boolean;
  onSubmit: (data: LoginFormValues) => Promise<void>;
  onSwitchToRegister: () => void;
}

function LoginDialogCard({
  error,
  isLoading,
  onSubmit,
  onSwitchToRegister,
}: LoginDialogCardProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <AuthFormCard
      title="登录继续创建"
      subtitle={(
        <>
          还没有账户？{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-medium text-primary transition-colors hover:text-primary-soft"
          >
            立即注册
          </button>
        </>
      )}
    >
      <form className="mt-8 space-y-6" onSubmit={handleSubmit((data) => void onSubmit(data))}>
        {error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
            {error}
          </div>
        ) : null}
        <div className="space-y-4">
          <div>
            <label htmlFor="public-home-login-email" className="mb-1 block text-sm font-medium text-slate-200">
              邮箱地址
            </label>
            <input
              id="public-home-login-email"
              {...register('email')}
              type="email"
              className="block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="请输入邮箱地址"
              aria-describedby="public-home-login-email-error"
            />
            {errors.email ? (
              <p id="public-home-login-email-error" className="mt-1 text-sm text-red-300">
                {errors.email.message}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="public-home-login-password" className="mb-1 block text-sm font-medium text-slate-200">
              密码
            </label>
            <input
              id="public-home-login-password"
              {...register('password')}
              type="password"
              className="block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="请输入密码"
              aria-describedby="public-home-login-password-error"
            />
            {errors.password ? (
              <p id="public-home-login-password-error" className="mt-1 text-sm text-red-300">
                {errors.password.message}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center rounded-md border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-slate-950 transition-colors hover:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '登录中...' : '登录'}
        </button>
      </form>
    </AuthFormCard>
  );
}

interface RegisterDialogCardProps {
  error: string | null;
  isLoading: boolean;
  onSubmit: (data: RegisterFormValues) => Promise<void>;
  onSwitchToLogin: () => void;
}

function RegisterDialogCard({
  error,
  isLoading,
  onSubmit,
  onSwitchToLogin,
}: RegisterDialogCardProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  return (
    <AuthFormCard
      title="注册后开始创建"
      subtitle={(
        <>
          已有账户？{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-primary transition-colors hover:text-primary-soft"
          >
            去登录
          </button>
        </>
      )}
    >
      <form className="mt-8 space-y-6" onSubmit={handleSubmit((data) => void onSubmit(data))}>
        {error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
            {error}
          </div>
        ) : null}
        <div className="space-y-4">
          <div>
            <label htmlFor="public-home-register-username" className="mb-1 block text-sm font-medium text-slate-200">
              用户名
            </label>
            <input
              id="public-home-register-username"
              {...register('username')}
              type="text"
              className="block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="请输入用户名"
              aria-describedby="public-home-register-username-error"
            />
            {errors.username ? (
              <p id="public-home-register-username-error" className="mt-1 text-sm text-red-300">
                {errors.username.message}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="public-home-register-email" className="mb-1 block text-sm font-medium text-slate-200">
              邮箱地址
            </label>
            <input
              id="public-home-register-email"
              {...register('email')}
              type="email"
              className="block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="请输入邮箱地址"
              aria-describedby="public-home-register-email-error"
            />
            {errors.email ? (
              <p id="public-home-register-email-error" className="mt-1 text-sm text-red-300">
                {errors.email.message}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="public-home-register-password" className="mb-1 block text-sm font-medium text-slate-200">
              密码
            </label>
            <input
              id="public-home-register-password"
              {...register('password')}
              type="password"
              className="block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="请输入密码 (至少6个字符)"
              aria-describedby="public-home-register-password-error"
            />
            {errors.password ? (
              <p id="public-home-register-password-error" className="mt-1 text-sm text-red-300">
                {errors.password.message}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="public-home-register-confirm-password" className="mb-1 block text-sm font-medium text-slate-200">
              确认密码
            </label>
            <input
              id="public-home-register-confirm-password"
              {...register('confirmPassword')}
              type="password"
              className="block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="请再次输入密码"
              aria-describedby="public-home-register-confirm-password-error"
            />
            {errors.confirmPassword ? (
              <p id="public-home-register-confirm-password-error" className="mt-1 text-sm text-red-300">
                {errors.confirmPassword.message}
              </p>
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full justify-center rounded-md border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-slate-950 transition-colors hover:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '注册中...' : '注册'}
        </button>
      </form>
    </AuthFormCard>
  );
}

export default PublicHomePage;
