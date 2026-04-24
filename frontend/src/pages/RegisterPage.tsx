import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import AuthFormCard from '../components/auth/AuthFormCard';

const registerSchema = z.object({
  username: z.string().min(2, '用户名至少需要2个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const inputClassName = 'block w-full rounded-xl border border-white/12 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-primary/80 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30';
const errorMessageClassName = 'mt-2 text-sm text-red-300';

function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

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

  const onSubmit = async (data: RegisterFormValues) => {
    setError(null);
    try {
      await registerUser(data.username, data.email, data.password);
      toast.success('注册成功！');
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, '注册失败，请稍后重试');
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.2),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-200/80">
              Join Web Learn
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              创建账户，直接开始使用
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              注册后即可进入控制台，保存学习内容并继续您的创作流程。
            </p>
          </div>

          <AuthFormCard
            title="创建新账户"
            subtitle={(
              <span className="inline-flex flex-wrap items-center justify-center gap-1">
                <span>已经有账户？</span>
                <Link
                  to="/login"
                  className="font-medium text-primary transition-colors hover:text-primary-soft"
                >
                  登录已有账户
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
                  <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-200">
                    用户名
                  </label>
                  <input
                    id="username"
                    {...register('username')}
                    type="text"
                    className={inputClassName}
                    placeholder="请输入用户名"
                    aria-describedby={errors.username ? 'username-error' : undefined}
                    aria-invalid={errors.username ? 'true' : 'false'}
                  />
                  {errors.username ? (
                    <p id="username-error" className={errorMessageClassName}>{errors.username.message}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
                    邮箱地址
                  </label>
                  <input
                    id="email"
                    {...register('email')}
                    type="email"
                    className={inputClassName}
                    placeholder="请输入邮箱地址"
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    aria-invalid={errors.email ? 'true' : 'false'}
                  />
                  {errors.email ? (
                    <p id="email-error" className={errorMessageClassName}>{errors.email.message}</p>
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
                    className={inputClassName}
                    placeholder="请输入密码"
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    aria-invalid={errors.password ? 'true' : 'false'}
                  />
                  {errors.password ? (
                    <p id="password-error" className={errorMessageClassName}>{errors.password.message}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-200">
                    确认密码
                  </label>
                  <input
                    id="confirmPassword"
                    {...register('confirmPassword')}
                    type="password"
                    className={inputClassName}
                    placeholder="请再次输入密码"
                    aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                    aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                  />
                  {errors.confirmPassword ? (
                    <p id="confirmPassword-error" className={errorMessageClassName}>{errors.confirmPassword.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
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
                      注册中...
                    </>
                  ) : (
                    '注册'
                  )}
                </button>
                <p className="text-center text-xs leading-5 text-slate-400">
                  注册即表示您将创建一个新的学习账户，并在完成后进入控制台。
                </p>
              </div>
            </form>
          </AuthFormCard>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
