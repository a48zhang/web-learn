import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import AuthFormCard from '../components/auth/AuthFormCard';

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const standaloneAuthInputClassName = 'block w-full rounded-xl border border-white/12 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-primary/80 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30';
export const standaloneAuthErrorMessageClassName = 'mt-2 text-sm text-red-300';

interface StandaloneAuthPageShellProps {
  eyebrow: string;
  heroTitle: string;
  description: string;
  backgroundClassName: string;
  eyebrowClassName: string;
  children: ReactNode;
}

export function StandaloneAuthPageShell({
  eyebrow,
  heroTitle,
  description,
  backgroundClassName,
  eyebrowClassName,
  children,
}: StandaloneAuthPageShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className={`absolute inset-0 ${backgroundClassName}`} />
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className={`text-xs font-semibold uppercase tracking-[0.32em] ${eyebrowClassName}`}>
              {eyebrow}
            </p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {heroTitle}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {description}
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

interface AuthSubmitButtonProps {
  idleLabel: string;
  loadingLabel: string;
  isLoading: boolean;
}

export function AuthSubmitButton({
  idleLabel,
  loadingLabel,
  isLoading,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="group relative flex w-full justify-center rounded-xl border border-primary/40 bg-primary px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? (
        <>
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 animate-spin text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </span>
          {loadingLabel}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

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

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    try {
      await login(data.email, data.password);
      toast.success('登录成功！');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, '登录失败，请检查您的邮箱和密码');
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <StandaloneAuthPageShell
      eyebrow="WebLearn"
      heroTitle="欢迎回来"
      description=""
      backgroundClassName="bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.24),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_52%,_#020617_100%)]"
      eyebrowClassName="text-cyan-200/80"
    >
          <AuthFormCard
            title="登录您的账户"
            subtitle={(
              <span className="inline-flex flex-wrap items-center justify-center gap-1">
                <span>还没有账户？</span>
                <Link
                  to="/register"
                  className="font-medium text-primary transition-colors hover:text-primary-soft"
                >
                  注册新账户
                </Link>
              </span>
            )}
          >
            <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {error ? (
                <div
                  className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
                    邮箱地址
                  </label>
                  <input
                    id="email"
                    {...register('email')}
                    type="email"
                    className={standaloneAuthInputClassName}
                    placeholder="请输入邮箱地址"
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    aria-invalid={errors.email ? 'true' : 'false'}
                  />
                  {errors.email ? (
                    <p id="email-error" className={standaloneAuthErrorMessageClassName}>{errors.email.message}</p>
                  ) : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                      密码
                    </label>
                    <span className="text-xs text-slate-400">至少 6 个字符</span>
                  </div>
                  <input
                    id="password"
                    {...register('password')}
                    type="password"
                    className={standaloneAuthInputClassName}
                    placeholder="请输入密码"
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    aria-invalid={errors.password ? 'true' : 'false'}
                  />
                  {errors.password ? (
                    <p id="password-error" className={standaloneAuthErrorMessageClassName}>{errors.password.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <AuthSubmitButton idleLabel="登录" loadingLabel="登录中..." isLoading={isLoading} />
              </div>
            </form>
          </AuthFormCard>
    </StandaloneAuthPageShell>
  );
}

export default LoginPage;
