import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import AuthFormCard from '../components/auth/AuthFormCard';
import {
  AuthSubmitButton,
  StandaloneAuthPageShell,
  standaloneAuthErrorMessageClassName,
  standaloneAuthInputClassName,
} from './LoginPage';

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
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, '注册失败，请稍后重试');
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <StandaloneAuthPageShell
      eyebrow="WebLearn"
      heroTitle="开始你的学习之旅"
      description=""
      backgroundClassName="bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.2),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
      eyebrowClassName="text-emerald-200/80"
    >
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
                    className={standaloneAuthInputClassName}
                    placeholder="请输入用户名"
                    aria-describedby={errors.username ? 'username-error' : undefined}
                    aria-invalid={errors.username ? 'true' : 'false'}
                  />
                  {errors.username ? (
                    <p id="username-error" className={standaloneAuthErrorMessageClassName}>{errors.username.message}</p>
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

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-200">
                    确认密码
                  </label>
                  <input
                    id="confirmPassword"
                    {...register('confirmPassword')}
                    type="password"
                    className={standaloneAuthInputClassName}
                    placeholder="请再次输入密码"
                    aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                    aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                  />
                  {errors.confirmPassword ? (
                    <p id="confirmPassword-error" className={standaloneAuthErrorMessageClassName}>{errors.confirmPassword.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <AuthSubmitButton idleLabel="注册" loadingLabel="注册中..." isLoading={isLoading} />
              </div>
            </form>
          </AuthFormCard>
    </StandaloneAuthPageShell>
  );
}

export default RegisterPage;
