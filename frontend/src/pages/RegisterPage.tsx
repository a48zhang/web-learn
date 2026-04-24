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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_38%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] py-12 px-4 sm:px-6 lg:px-8">
      <AuthFormCard
        title="创建新账户"
        subtitle={(
          <>
            或者{' '}
            <Link
              to="/login"
              className="font-medium text-primary transition-colors hover:text-primary-soft"
            >
              登录已有账户
            </Link>
          </>
        )}
      >
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-200">
                用户名
              </label>
              <input
                id="username"
                {...register('username')}
                type="text"
                className="relative block w-full appearance-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="请输入用户名"
                aria-describedby="username-error"
              />
              {errors.username && (
                <p id="username-error" className="mt-1 text-sm text-red-300">{errors.username.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-200">
                邮箱地址
              </label>
              <input
                id="email"
                {...register('email')}
                type="email"
                className="relative block w-full appearance-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="请输入邮箱地址"
                aria-describedby="email-error"
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-300">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-200">
                密码
              </label>
              <input
                id="password"
                {...register('password')}
                type="password"
                className="relative block w-full appearance-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="请输入密码 (至少6个字符)"
                aria-describedby="password-error"
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-300">{errors.password.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-slate-200">
                确认密码
              </label>
              <input
                id="confirmPassword"
                {...register('confirmPassword')}
                type="password"
                className="relative block w-full appearance-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="请再次输入密码"
                aria-describedby="confirmPassword-error"
              />
              {errors.confirmPassword && (
                <p id="confirmPassword-error" className="mt-1 text-sm text-red-300">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md border border-primary/40 bg-primary px-4 py-2.5 text-sm font-medium text-slate-950 transition-colors hover:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg className="animate-spin h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          </div>
        </form>
      </AuthFormCard>
    </div>
  );
}

export default RegisterPage;
