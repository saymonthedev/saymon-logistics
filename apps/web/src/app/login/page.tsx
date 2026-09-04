'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const loginSchema = z.object({
  loginEmail: z.string().email('Informe um email válido'),
  loginPassword: z.string().min(1, 'Informe a senha'),
});
type LoginForm = z.infer<typeof loginSchema>;

const FEATURES = ['Pedidos e expedição em tempo real', 'Estoque com reserva sem conflitos', 'Ondas de separação por produto', 'Alertas operacionais automáticos'];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const mutation = useMutation({
    mutationFn: (values: LoginForm) =>
      api.post('/auth/login', { email: values.loginEmail, password: values.loginPassword }),
    onSuccess: async () => {
      await refetch();
      router.replace(searchParams.get('next') || '/dashboard');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao entrar');
    },
  });

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#4d7ef0] to-[#1a3577] px-12 py-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <Image src="/logo-mark.svg" alt="" width={36} height={36} className="h-9 w-9" />
          <span className="text-lg font-semibold">Saymon Logistics</span>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-semibold leading-tight">
            O centro de controle da sua operação logística.
          </h1>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-blue-50/90">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-blue-200">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5a1 1 0 111.4-1.4l3.9 3.9 6.7-6.7a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-blue-100/60">© {new Date().getFullYear()} Saymon Logistics</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 lg:hidden">
            <Image src="/logo-mark.svg" alt="" width={40} height={40} className="mb-4 h-10 w-10" />
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">Entrar</h2>
          <p className="mt-1 mb-8 text-sm text-slate-500">Acesse sua conta para continuar.</p>

          <form
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            autoComplete="off"
            className="space-y-4"
          >
            {/* Decoy fields: absorb the browser's autofill heuristics so it
                leaves the real fields below alone. */}
            <div aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
              <input type="text" name="username" autoComplete="username" tabIndex={-1} />
              <input type="password" name="password" autoComplete="new-password" tabIndex={-1} />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore=""
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="voce@empresa.com"
                {...register('loginEmail')}
              />
              {errors.loginEmail && <p className="mt-1.5 text-xs text-red-600">{errors.loginEmail.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Senha</label>
              <input
                type="password"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore=""
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="••••••••"
                {...register('loginPassword')}
              />
              {errors.loginPassword && <p className="mt-1.5 text-xs text-red-600">{errors.loginPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {mutation.isPending ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
