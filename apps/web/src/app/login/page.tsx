'use client';

import { Suspense, useId } from 'react';
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

/** Drops the readonly attribute on first focus — Chrome only skips its
 *  autofill/autocomplete UI on fields that are readonly when the page
 *  loads, so this keeps the field fully editable for the user while
 *  never giving the browser a writable field to attach suggestions to. */
function clearReadOnly(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.removeAttribute('readonly');
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useAuth();

  // Only used for the id/label pairing below — the `name` attribute must
  // stay whatever react-hook-form's register() sets (it reads
  // event.target.name internally to know which field changed), so the
  // fields are named loginEmail/loginPassword instead of the standard
  // "email"/"password" Chrome's autofill heuristics look for.
  const uid = useId().replace(/:/g, '');

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const emailField = register('loginEmail');
  const passwordField = register('loginPassword');

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
    <div className="flex min-h-screen flex-col bg-[#0c0e13]">
      <header className="flex items-center gap-2 px-6 py-5 sm:px-10">
        <Image src="/logo-mark.svg" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
        <span className="text-sm font-medium text-white/70">Saymon Logistics</span>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[320px]">
          <h1 className="text-lg font-medium text-white">Entrar na plataforma</h1>
          <p className="mt-1 text-sm text-white/40">Use suas credenciais de operação.</p>

          <form
            onSubmit={handleSubmit(
              (values) => mutation.mutate(values),
              (errors) => {
                const message = errors.loginEmail?.message ?? errors.loginPassword?.message;
                if (message) toast.error(message);
              },
            )}
            autoComplete="off"
            className="mt-7 space-y-4"
          >
            {/* Decoy fields: Chrome's autofill heuristics latch onto the
                first username/password-shaped inputs it finds, so these
                absorb it and leave the real fields below alone. */}
            <div aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
              <input type="text" name="username" autoComplete="username" tabIndex={-1} />
              <input type="password" name="password" autoComplete="new-password" tabIndex={-1} />
            </div>

            <div>
              <label htmlFor={`e-${uid}`} className="mb-1.5 block text-xs font-medium text-white/50">
                Email
              </label>
              <input
                {...emailField}
                id={`e-${uid}`}
                type="email"
                readOnly
                onFocus={clearReadOnly}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore=""
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brand-500 focus:bg-white/[0.07]"
              />
            </div>

            <div>
              <label htmlFor={`p-${uid}`} className="mb-1.5 block text-xs font-medium text-white/50">
                Senha
              </label>
              <input
                {...passwordField}
                id={`p-${uid}`}
                type="password"
                readOnly
                onFocus={clearReadOnly}
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore=""
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-brand-500 focus:bg-white/[0.07]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="w-full rounded-md bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
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
